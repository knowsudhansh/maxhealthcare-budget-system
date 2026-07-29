const {
  createRole,
  getRole,
  getRolePermissions,
  getUserRoles,
  listPermissions,
  listRoles,
  seedRbacRegistry,
  setRolePermissions,
  setUserRoles
} = require("./rbac.service");
const {
  normalizePermissionAssignmentPayload,
  normalizeRoleAssignmentPayload,
  normalizeRoleId,
  normalizeRolePayload,
  normalizeUserId
} = require("./rbac.validation");
const { clientInfo } = require("../auth/auth.service");

function success(req, res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req.requestId || ""
  });
}

async function roles(req, res, next) {
  try {
    return success(req, res, { roles: await listRoles() });
  } catch (error) {
    return next(error);
  }
}

async function permissions(req, res, next) {
  try {
    return success(req, res, { permissions: await listPermissions() });
  } catch (error) {
    return next(error);
  }
}

async function role(req, res, next) {
  try {
    return success(req, res, { role: await getRole(normalizeRoleId(req.params.roleId)) });
  } catch (error) {
    return next(error);
  }
}

async function rolePermissions(req, res, next) {
  try {
    return success(req, res, {
      permissions: await getRolePermissions(normalizeRoleId(req.params.roleId))
    });
  } catch (error) {
    return next(error);
  }
}

async function updateRolePermissions(req, res, next) {
  try {
    const roleId = normalizeRoleId(req.params.roleId);
    const payload = normalizePermissionAssignmentPayload(req.body || {});
    const result = await setRolePermissions(roleId, payload.permissionCodes, {
      requestId: req.requestId,
      auth: req.auth,
      clientInfo: clientInfo(req)
    });
    return success(req, res, result);
  } catch (error) {
    return next(error);
  }
}

async function userRoles(req, res, next) {
  try {
    return success(req, res, {
      roles: await getUserRoles(normalizeUserId(req.params.userId))
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUserRoles(req, res, next) {
  try {
    const userId = normalizeUserId(req.params.userId);
    const payload = normalizeRoleAssignmentPayload(req.body || {});
    const roles = await setUserRoles(userId, payload.roleIds, {
      validFrom: payload.validFrom,
      validUntil: payload.validUntil
    }, {
      requestId: req.requestId,
      auth: req.auth,
      clientInfo: clientInfo(req)
    });
    return success(req, res, { roles });
  } catch (error) {
    return next(error);
  }
}

async function createRoleHandler(req, res, next) {
  try {
    const role = await createRole(normalizeRolePayload(req.body || {}), {
      requestId: req.requestId,
      auth: req.auth,
      clientInfo: clientInfo(req)
    });
    return success(req, res, { role }, 201);
  } catch (error) {
    return next(error);
  }
}

async function seed(req, res, next) {
  try {
    const result = await seedRbacRegistry({ requestId: req.requestId });
    return success(req, res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRole: createRoleHandler,
  permissions,
  role,
  rolePermissions,
  roles,
  seed,
  updateRolePermissions,
  updateUserRoles,
  userRoles
};
