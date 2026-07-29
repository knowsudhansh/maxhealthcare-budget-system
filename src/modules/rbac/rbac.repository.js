function mapRole(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || "",
    isSystemRole: Boolean(row.is_system_role),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPermission(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    module: row.module,
    action: row.action,
    description: row.description || "",
    createdAt: row.created_at
  };
}

async function upsertRole(db, role) {
  await db.execute(
    `
      INSERT INTO roles (code, name, description, is_system_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        is_system_role = VALUES(is_system_role),
        updated_at = NOW()
    `,
    [role.code, role.name, role.description || null, role.isSystemRole ? 1 : 0]
  );
}

async function upsertPermission(db, permission) {
  await db.execute(
    `
      INSERT INTO permissions (code, module, action, description, created_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        module = VALUES(module),
        action = VALUES(action),
        description = VALUES(description)
    `,
    [permission.code, permission.module, permission.action, permission.description || null]
  );
}

async function findRoleByCode(db, code) {
  const [rows] = await db.execute("SELECT * FROM roles WHERE code = ? LIMIT 1", [code]);
  return mapRole(rows && rows[0]);
}

async function findRoleById(db, roleId) {
  const [rows] = await db.execute("SELECT * FROM roles WHERE id = ? LIMIT 1", [roleId]);
  return mapRole(rows && rows[0]);
}

async function findPermissionByCode(db, code) {
  const [rows] = await db.execute("SELECT * FROM permissions WHERE code = ? LIMIT 1", [code]);
  return mapPermission(rows && rows[0]);
}

async function findPermissionsByCodes(db, codes) {
  if (!codes.length) return [];
  const placeholders = codes.map(() => "?").join(", ");
  const [rows] = await db.execute(
    `SELECT * FROM permissions WHERE code IN (${placeholders}) ORDER BY code`,
    codes
  );
  return (rows || []).map(mapPermission);
}

async function assignPermissionToRole(db, roleId, permissionId) {
  await db.execute(
    `
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
    `,
    [roleId, permissionId]
  );
}

async function replaceRolePermissions(db, roleId, permissionIds) {
  await db.execute("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
  for (const permissionId of permissionIds) {
    await assignPermissionToRole(db, roleId, permissionId);
  }
}

async function replaceUserRoles(db, userId, roleIds, actorUserId, validity = {}) {
  await db.execute("DELETE FROM user_roles WHERE user_id = ?", [userId]);
  for (const roleId of roleIds) {
    await db.execute(
      `
        INSERT INTO user_roles (user_id, role_id, valid_from, valid_until, assigned_by, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          valid_from = VALUES(valid_from),
          valid_until = VALUES(valid_until),
          assigned_by = VALUES(assigned_by)
      `,
      [userId, roleId, validity.validFrom || null, validity.validUntil || null, actorUserId || null]
    );
  }
}

async function listRoles(db) {
  const [rows] = await db.query("SELECT * FROM roles ORDER BY code");
  return (rows || []).map(mapRole);
}

async function listPermissions(db) {
  const [rows] = await db.query("SELECT * FROM permissions ORDER BY module, code");
  return (rows || []).map(mapPermission);
}

async function listRolePermissions(db, roleId) {
  const [rows] = await db.execute(
    `
      SELECT p.*
      FROM role_permissions rp
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.code
    `,
    [roleId]
  );
  return (rows || []).map(mapPermission);
}

async function listUserRoles(db, userId) {
  const [rows] = await db.execute(
    `
      SELECT r.*, ur.valid_from, ur.valid_until, ur.assigned_by, ur.created_at AS assigned_at
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.code
    `,
    [userId]
  );
  return (rows || []).map((row) => Object.assign(mapRole(row), {
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at
  }));
}

async function resolveEffectivePermissions(db, userId) {
  const [rows] = await db.execute(
    `
      SELECT
        u.id AS user_id,
        u.employee_id,
        u.email,
        u.display_name,
        u.status,
        r.code AS role_code,
        p.code AS permission_code
      FROM users u
      LEFT JOIN user_roles ur
        ON ur.user_id = u.id
       AND (ur.valid_from IS NULL OR ur.valid_from <= NOW())
       AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = ?
    `,
    [userId]
  );
  return rows || [];
}

async function countUsersWithRoleCode(db, roleCode) {
  const [rows] = await db.execute(
    `
      SELECT COUNT(DISTINCT ur.user_id) AS count
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      INNER JOIN users u ON u.id = ur.user_id
      WHERE r.code = ?
        AND u.status <> 'DISABLED'
        AND (ur.valid_from IS NULL OR ur.valid_from <= NOW())
        AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
    `,
    [roleCode]
  );
  return Number(rows && rows[0] ? rows[0].count : 0);
}

async function userHasRoleCode(db, userId, roleCode) {
  const [rows] = await db.execute(
    `
      SELECT 1 AS ok
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
        AND r.code = ?
        AND (ur.valid_from IS NULL OR ur.valid_from <= NOW())
        AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
      LIMIT 1
    `,
    [userId, roleCode]
  );
  return Boolean(rows && rows[0]);
}

async function createCustomRole(db, role) {
  const [result] = await db.execute(
    `
      INSERT INTO roles (code, name, description, is_system_role, created_at, updated_at)
      VALUES (?, ?, ?, 0, NOW(), NOW())
    `,
    [role.code, role.name, role.description || null]
  );
  return findRoleById(db, result.insertId);
}

module.exports = {
  assignPermissionToRole,
  countUsersWithRoleCode,
  createCustomRole,
  findPermissionByCode,
  findPermissionsByCodes,
  findRoleByCode,
  findRoleById,
  listPermissions,
  listRolePermissions,
  listRoles,
  listUserRoles,
  replaceRolePermissions,
  replaceUserRoles,
  resolveEffectivePermissions,
  upsertPermission,
  upsertRole,
  userHasRoleCode
};
