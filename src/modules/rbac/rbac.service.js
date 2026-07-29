const { AppError, validationError } = require("../../errors/app-error");
const { getPool } = require("../../db/pool");
const { withTransaction } = require("../../db/transaction");
const authRepo = require("../auth/auth.repository");
const { USER_STATUS } = require("../auth/auth.constants");
const {
  ALL_PERMISSION_CODES,
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSION_MATRIX,
  ROLES
} = require("./rbac.constants");
const repo = require("./rbac.repository");

function forbiddenError(message = "You do not have permission to perform this action.") {
  return new AppError({
    statusCode: 403,
    publicCode: "FORBIDDEN",
    publicMessage: message
  });
}

function notFound(message) {
  return new AppError({
    statusCode: 404,
    publicCode: "RECORD_NOT_FOUND",
    publicMessage: message
  });
}

function hasSuperAdmin(auth) {
  return Boolean(auth && Array.isArray(auth.roles) && auth.roles.includes(ROLE_CODES.SUPER_ADMIN));
}

function actorId(auth) {
  return auth && auth.user && auth.user.id ? auth.user.id : null;
}

async function auditSecurityEvent(db, event) {
  try {
    await authRepo.insertSecurityAuditEvent(db, event);
  } catch (_error) {
    // RBAC operations must not expose audit-table availability to API callers.
  }
}

async function seedRbacRegistry(context = {}) {
  return withTransaction(async (connection) => {
    for (const role of ROLES) {
      await repo.upsertRole(connection, role);
    }
    for (const permission of PERMISSIONS) {
      await repo.upsertPermission(connection, permission);
    }
    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      const role = await repo.findRoleByCode(connection, roleCode);
      const permissions = await repo.findPermissionsByCodes(connection, permissionCodes);
      for (const permission of permissions) {
        await repo.assignPermissionToRole(connection, role.id, permission.id);
      }
    }
    return {
      roles: ROLES.length,
      permissions: PERMISSIONS.length,
      rolePermissions: Object.values(ROLE_PERMISSION_MATRIX).reduce((sum, codes) => sum + codes.length, 0)
    };
  }, { requestId: context.requestId || "" });
}

async function resolveAuthorizationContext(user) {
  if (!user || !user.id) return null;
  const pool = getPool();
  const rows = await repo.resolveEffectivePermissions(pool, user.id);
  if (!rows.length) return null;
  const first = rows[0];
  if (first.status === USER_STATUS.DISABLED) return null;
  const roles = Array.from(new Set(rows.map((row) => row.role_code).filter(Boolean))).sort();
  const permissions = Array.from(new Set(rows.map((row) => row.permission_code).filter(Boolean))).sort();
  return {
    userId: first.user_id,
    employeeId: first.employee_id,
    email: first.email,
    displayName: first.display_name,
    status: first.status,
    roles,
    permissions
  };
}

async function listRoles() {
  return repo.listRoles(getPool());
}

async function listPermissions() {
  return repo.listPermissions(getPool());
}

async function getRole(roleId) {
  const role = await repo.findRoleById(getPool(), roleId);
  if (!role) throw notFound("Role not found.");
  return role;
}

async function getRolePermissions(roleId) {
  await getRole(roleId);
  return repo.listRolePermissions(getPool(), roleId);
}

async function setRolePermissions(roleId, permissionCodes, context = {}) {
  return withTransaction(async (connection) => {
    const role = await repo.findRoleById(connection, roleId);
    if (!role) throw notFound("Role not found.");
    const isSensitiveChange = permissionCodes.includes("security.manage") || role.code === ROLE_CODES.SUPER_ADMIN;
    if (isSensitiveChange && !hasSuperAdmin(context.auth)) {
      await auditDenied(connection, "RBAC_PRIVILEGE_ESCALATION_BLOCKED", "roles", roleId, context);
      throw forbiddenError("SUPER_ADMIN is required for this role-permission change.");
    }
    const permissions = await repo.findPermissionsByCodes(connection, permissionCodes);
    if (permissions.length !== permissionCodes.length) throw validationError("One or more permissions do not exist.");
    await repo.replaceRolePermissions(connection, roleId, permissions.map((permission) => permission.id));
    await auditSecurityEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: "RBAC_ROLE_PERMISSIONS_UPDATED",
      resourceType: "roles",
      resourceId: String(roleId),
      outcome: "SUCCESS",
      metadata: { roleCode: role.code, permissionCodes }
    });
    return { role, permissions };
  }, { requestId: context.requestId || "" });
}

async function getUserRoles(userId) {
  return repo.listUserRoles(getPool(), userId);
}

async function setUserRoles(userId, roleIds, validity = {}, context = {}) {
  return withTransaction(async (connection) => {
    const existingRoles = await repo.listUserRoles(connection, userId);
    const newRoles = [];
    for (const roleId of roleIds) {
      const role = await repo.findRoleById(connection, roleId);
      if (!role) throw validationError("One or more roles do not exist.");
      newRoles.push(role);
    }
    const assignsSuper = newRoles.some((role) => role.code === ROLE_CODES.SUPER_ADMIN);
    if (assignsSuper && !hasSuperAdmin(context.auth)) {
      await auditDenied(connection, "RBAC_SUPER_ADMIN_ASSIGNMENT_BLOCKED", "users", userId, context);
      throw forbiddenError("SUPER_ADMIN is required to assign SUPER_ADMIN.");
    }
    const hadSuper = existingRoles.some((role) => role.code === ROLE_CODES.SUPER_ADMIN);
    const keepsSuper = newRoles.some((role) => role.code === ROLE_CODES.SUPER_ADMIN);
    if (hadSuper && !keepsSuper) {
      const count = await repo.countUsersWithRoleCode(connection, ROLE_CODES.SUPER_ADMIN);
      if (count <= 1) {
        await auditDenied(connection, "RBAC_FINAL_SUPER_ADMIN_REMOVAL_BLOCKED", "users", userId, context);
        throw forbiddenError("The final active SUPER_ADMIN cannot be removed.");
      }
    }
    await repo.replaceUserRoles(connection, userId, roleIds, actorId(context.auth), validity);
    await auditSecurityEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: "RBAC_USER_ROLES_UPDATED",
      resourceType: "users",
      resourceId: String(userId),
      outcome: "SUCCESS",
      metadata: { roleCodes: newRoles.map((role) => role.code) }
    });
    return repo.listUserRoles(connection, userId);
  }, { requestId: context.requestId || "" });
}

async function createRole(payload, context = {}) {
  return withTransaction(async (connection) => {
    const role = await repo.createCustomRole(connection, payload);
    await auditSecurityEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: "RBAC_ROLE_CREATED",
      resourceType: "roles",
      resourceId: String(role.id),
      outcome: "SUCCESS",
      metadata: { roleCode: role.code }
    });
    return role;
  }, { requestId: context.requestId || "" });
}

async function auditDenied(connection, eventType, resourceType, resourceId, context) {
  await auditSecurityEvent(connection, {
    actorUserId: actorId(context.auth),
    eventType,
    resourceType,
    resourceId: String(resourceId),
    outcome: "DENIED",
    metadata: { reason: "insufficient_permission" },
    ipAddress: context.clientInfo && context.clientInfo.ipAddress,
    userAgent: context.clientInfo && context.clientInfo.userAgent
  });
}

function assertKnownPermission(permissionCode) {
  if (!ALL_PERMISSION_CODES.includes(permissionCode)) {
    throw new Error(`Unknown permission configured in middleware: ${permissionCode}`);
  }
}

module.exports = {
  assertKnownPermission,
  createRole,
  forbiddenError,
  getRole,
  getRolePermissions,
  getUserRoles,
  hasSuperAdmin,
  listPermissions,
  listRoles,
  resolveAuthorizationContext,
  seedRbacRegistry,
  setRolePermissions,
  setUserRoles
};
