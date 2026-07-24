function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    status: row.status,
    failedLoginAttempts: Number(row.failed_login_attempts || 0),
    lockedUntil: row.locked_until,
    mustChangePassword: Boolean(row.must_change_password),
    passwordChangedAt: row.password_changed_at,
    lastLoginAt: row.last_login_at
  };
}

async function findUserByIdentifier(db, identifier) {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM users
      WHERE LOWER(employee_id) = LOWER(?)
         OR LOWER(email) = LOWER(?)
      LIMIT 1
    `,
    [identifier, identifier]
  );
  return mapUser(rows && rows[0]);
}

async function findUserById(db, userId) {
  const [rows] = await db.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  return mapUser(rows && rows[0]);
}

async function countUsers(db) {
  const [rows] = await db.query("SELECT COUNT(*) AS count FROM users");
  return Number(rows && rows[0] ? rows[0].count : 0);
}

async function insertUser(db, user) {
  const [result] = await db.execute(
    `
      INSERT INTO users (
        employee_id,
        email,
        display_name,
        password_hash,
        status,
        must_change_password,
        password_changed_at,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `,
    [
      user.employeeId,
      user.email,
      user.displayName,
      user.passwordHash,
      user.status,
      user.mustChangePassword ? 1 : 0,
      user.createdBy || null,
      user.updatedBy || null
    ]
  );
  return findUserById(db, result.insertId);
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
  const [rows] = await db.execute("SELECT * FROM roles WHERE code = ? LIMIT 1", [role.code]);
  return rows && rows[0] ? rows[0] : null;
}

async function assignRole(db, userId, roleId, assignedBy) {
  await db.execute(
    `
      INSERT INTO user_roles (user_id, role_id, valid_from, assigned_by, created_at)
      VALUES (?, ?, NOW(), ?, NOW())
      ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)
    `,
    [userId, roleId, assignedBy || null]
  );
}

async function updateFailedLogin(db, userId, attempts, lockedUntil) {
  await db.execute(
    "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = NOW() WHERE id = ?",
    [attempts, lockedUntil || null, userId]
  );
}

async function markLoginSuccess(db, userId) {
  await db.execute(
    "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?",
    [userId]
  );
}

async function updatePassword(db, userId, passwordHash) {
  await db.execute(
    `
      UPDATE users
      SET password_hash = ?,
          must_change_password = 0,
          password_changed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `,
    [passwordHash, userId]
  );
  await db.execute(
    "INSERT INTO password_history (user_id, password_hash, created_at) VALUES (?, ?, NOW())",
    [userId, passwordHash]
  );
}

async function insertLoginAttempt(db, attempt) {
  await db.execute(
    `
      INSERT INTO login_attempts (
        employee_id_or_email_hash,
        user_id,
        success,
        failure_reason,
        ip_address,
        user_agent,
        attempted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      attempt.identifierHash,
      attempt.userId || null,
      attempt.success ? 1 : 0,
      attempt.failureReason || null,
      attempt.ipAddress || null,
      attempt.userAgent || null
    ]
  );
}

async function insertSecurityAuditEvent(db, event) {
  await db.execute(
    `
      INSERT INTO security_audit_events (
        actor_user_id,
        event_type,
        resource_type,
        resource_id,
        outcome,
        metadata_json,
        ip_address,
        user_agent,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      event.actorUserId || null,
      event.eventType,
      event.resourceType || null,
      event.resourceId || null,
      event.outcome,
      JSON.stringify(event.metadata || {}),
      event.ipAddress || null,
      event.userAgent || null
    ]
  );
}

async function createSession(db, session) {
  const [result] = await db.execute(
    `
      INSERT INTO user_sessions (
        user_id,
        session_token_hash,
        ip_address,
        user_agent,
        expires_at,
        created_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [session.userId, session.tokenHash, session.ipAddress || null, session.userAgent || null, session.expiresAt]
  );
  return result.insertId;
}

async function findActiveSession(db, tokenHash) {
  const [rows] = await db.execute(
    `
      SELECT
        s.*,
        u.employee_id,
        u.email,
        u.display_name,
        u.status,
        u.must_change_password
      FROM user_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.session_token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash]
  );
  const row = rows && rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    user: {
      id: row.user_id,
      employeeId: row.employee_id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      mustChangePassword: Boolean(row.must_change_password)
    }
  };
}

async function touchSession(db, sessionId) {
  await db.execute("UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?", [sessionId]);
}

async function revokeSession(db, tokenHash) {
  const [result] = await db.execute(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE session_token_hash = ? AND revoked_at IS NULL",
    [tokenHash]
  );
  return result.affectedRows || 0;
}

async function revokeUserSessions(db, userId) {
  const [result] = await db.execute(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
    [userId]
  );
  return result.affectedRows || 0;
}

module.exports = {
  countUsers,
  createSession,
  findActiveSession,
  findUserById,
  findUserByIdentifier,
  insertLoginAttempt,
  insertSecurityAuditEvent,
  insertUser,
  markLoginSuccess,
  revokeSession,
  revokeUserSessions,
  touchSession,
  assignRole,
  upsertRole,
  updateFailedLogin,
  updatePassword
};
