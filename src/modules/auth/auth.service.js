const crypto = require("crypto");
const { getPool } = require("../../db/pool");
const { withTransaction } = require("../../db/transaction");
const { AUTH_ERROR_CODES, SECURITY_EVENTS, USER_STATUS } = require("./auth.constants");
const { authError } = require("./auth.errors");
const { hashPassword, validatePasswordPolicy, verifyPassword } = require("./password");
const { createSessionToken, hashSessionToken } = require("./session");
const repo = require("./auth.repository");

const DEVELOPMENT_SESSION_SECRET = crypto.randomBytes(32).toString("hex");

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    employeeId: user.employeeId,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword)
  };
}

function identifierHash(identifier, secret) {
  return crypto
    .createHmac("sha256", String(secret || ""))
    .update(String(identifier || "").toLowerCase())
    .digest("hex");
}

function clientInfo(req) {
  return {
    ipAddress: req ? String(req.ip || req.socket && req.socket.remoteAddress || "") : "",
    userAgent: req ? String(req.headers["user-agent"] || "").slice(0, 512) : ""
  };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getAuthConfig(runtimeConfig) {
  const auth = runtimeConfig && runtimeConfig.auth ? runtimeConfig.auth : {};
  return {
    sessionSecret: auth.sessionSecret || process.env.AUTH_SESSION_SECRET || DEVELOPMENT_SESSION_SECRET,
    sessionTtlMinutes: auth.sessionTtlMinutes || Number(process.env.AUTH_SESSION_TTL_MINUTES || 720),
    idleTimeoutMinutes: auth.idleTimeoutMinutes || Number(process.env.AUTH_IDLE_TIMEOUT_MINUTES || 60),
    cookieName: auth.cookieName || process.env.AUTH_COOKIE_NAME || "max_it_opex_session",
    cookieSecure: Object.prototype.hasOwnProperty.call(auth, "cookieSecure") ? auth.cookieSecure : process.env.AUTH_COOKIE_SECURE === "true",
    cookieSameSite: auth.cookieSameSite || process.env.AUTH_COOKIE_SAME_SITE || "Lax",
    maxLoginAttempts: auth.maxLoginAttempts || Number(process.env.AUTH_MAX_LOGIN_ATTEMPTS || 5),
    lockoutMinutes: auth.lockoutMinutes || Number(process.env.AUTH_LOCKOUT_MINUTES || 15),
    passwordMinLength: auth.passwordMinLength || Number(process.env.AUTH_PASSWORD_MIN_LENGTH || 12)
  };
}

function invalidCredentialsError() {
  return authError(401, AUTH_ERROR_CODES.INVALID_CREDENTIALS, "Invalid employee ID/email or password.");
}

function accountLockedError() {
  return authError(423, AUTH_ERROR_CODES.ACCOUNT_LOCKED, "Account is temporarily locked. Please try again later.");
}

async function recordSecurityEvent(db, event) {
  try {
    await repo.insertSecurityAuditEvent(db, event);
  } catch (_error) {
    // Security audit table may not be applied yet in lower environments. Authentication must still return a safe response.
  }
}

async function login(payload, context = {}) {
  const config = getAuthConfig(context.runtimeConfig);
  const info = context.clientInfo || {};
  return withTransaction(async (connection) => {
    const identifierDigest = identifierHash(payload.identifier, config.sessionSecret);
    const user = await repo.findUserByIdentifier(connection, payload.identifier);

    if (!user) {
      await repo.insertLoginAttempt(connection, {
        identifierHash: identifierDigest,
        success: false,
        failureReason: "INVALID_CREDENTIALS",
        ipAddress: info.ipAddress,
        userAgent: info.userAgent
      });
      throw invalidCredentialsError();
    }

    if (user.status === USER_STATUS.DISABLED) {
      await repo.insertLoginAttempt(connection, {
        identifierHash: identifierDigest,
        userId: user.id,
        success: false,
        failureReason: "ACCOUNT_DISABLED",
        ipAddress: info.ipAddress,
        userAgent: info.userAgent
      });
      throw authError(403, AUTH_ERROR_CODES.ACCOUNT_DISABLED, "Account is disabled.");
    }

    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      await repo.insertLoginAttempt(connection, {
        identifierHash: identifierDigest,
        userId: user.id,
        success: false,
        failureReason: "ACCOUNT_LOCKED",
        ipAddress: info.ipAddress,
        userAgent: info.userAgent
      });
      throw accountLockedError();
    }

    const passwordOk = await verifyPassword(payload.password, user.passwordHash);
    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      const locked = attempts >= config.maxLoginAttempts;
      const lockedUntilValue = locked ? mysqlDate(addMinutes(new Date(), config.lockoutMinutes)) : null;
      await repo.updateFailedLogin(connection, user.id, attempts, lockedUntilValue);
      await repo.insertLoginAttempt(connection, {
        identifierHash: identifierDigest,
        userId: user.id,
        success: false,
        failureReason: locked ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
        ipAddress: info.ipAddress,
        userAgent: info.userAgent
      });
      if (locked) {
        await recordSecurityEvent(connection, {
          actorUserId: user.id,
          eventType: SECURITY_EVENTS.ACCOUNT_LOCKED,
          resourceType: "users",
          resourceId: String(user.id),
          outcome: "LOCKED",
          metadata: { reason: "failed_login_attempts" },
          ipAddress: info.ipAddress,
          userAgent: info.userAgent
        });
      }
      throw invalidCredentialsError();
    }

    await repo.markLoginSuccess(connection, user.id);
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token, config.sessionSecret);
    const expiresAt = mysqlDate(addMinutes(new Date(), config.sessionTtlMinutes));
    await repo.createSession(connection, {
      userId: user.id,
      tokenHash,
      ipAddress: info.ipAddress,
      userAgent: info.userAgent,
      expiresAt
    });
    await repo.insertLoginAttempt(connection, {
      identifierHash: identifierDigest,
      userId: user.id,
      success: true,
      ipAddress: info.ipAddress,
      userAgent: info.userAgent
    });
    await recordSecurityEvent(connection, {
      actorUserId: user.id,
      eventType: SECURITY_EVENTS.LOGIN_SUCCESS,
      resourceType: "users",
      resourceId: String(user.id),
      outcome: "SUCCESS",
      ipAddress: info.ipAddress,
      userAgent: info.userAgent
    });

    return {
      token,
      expiresAt,
      user: publicUser(user)
    };
  }, { requestId: context.requestId || "" });
}

async function loadSession(token, runtimeConfig) {
  if (!token) return null;
  const config = getAuthConfig(runtimeConfig);
  const pool = getPool();
  const session = await repo.findActiveSession(pool, hashSessionToken(token, config.sessionSecret));
  if (!session) return null;
  await repo.touchSession(pool, session.id);
  return {
    id: session.id,
    user: session.user
  };
}

async function logout(token, context = {}) {
  if (!token) return { revoked: false };
  const config = getAuthConfig(context.runtimeConfig);
  const pool = getPool();
  const tokenHash = hashSessionToken(token, config.sessionSecret);
  const session = await repo.findActiveSession(pool, tokenHash);
  const revoked = await repo.revokeSession(pool, tokenHash);
  if (session) {
    await recordSecurityEvent(pool, {
      actorUserId: session.userId,
      eventType: SECURITY_EVENTS.LOGOUT,
      resourceType: "user_sessions",
      resourceId: String(session.id),
      outcome: "SUCCESS",
      ipAddress: context.clientInfo && context.clientInfo.ipAddress,
      userAgent: context.clientInfo && context.clientInfo.userAgent
    });
  }
  return { revoked: Boolean(revoked) };
}

async function changePassword(user, payload, context = {}) {
  const config = getAuthConfig(context.runtimeConfig);
  return withTransaction(async (connection) => {
    const current = await repo.findUserById(connection, user.id);
    if (!current) throw authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required.");
    const passwordOk = await verifyPassword(payload.currentPassword, current.passwordHash);
    if (!passwordOk) throw invalidCredentialsError();
    const policyErrors = validatePasswordPolicy(payload.newPassword, current, { minLength: config.passwordMinLength });
    if (policyErrors.length) {
      throw authError(422, AUTH_ERROR_CODES.PASSWORD_POLICY_VIOLATION, "Password does not meet policy.", { policyErrors });
    }
    const passwordHash = await hashPassword(payload.newPassword);
    await repo.updatePassword(connection, current.id, passwordHash);
    await repo.revokeUserSessions(connection, current.id);
    await recordSecurityEvent(connection, {
      actorUserId: current.id,
      eventType: SECURITY_EVENTS.PASSWORD_CHANGED,
      resourceType: "users",
      resourceId: String(current.id),
      outcome: "SUCCESS",
      ipAddress: context.clientInfo && context.clientInfo.ipAddress,
      userAgent: context.clientInfo && context.clientInfo.userAgent
    });
    return { changed: true };
  }, { requestId: context.requestId || "" });
}

async function bootstrapAdmin(payload, context = {}) {
  const config = getAuthConfig(context.runtimeConfig);
  const policyErrors = validatePasswordPolicy(payload.password, payload, { minLength: config.passwordMinLength });
  if (policyErrors.length) {
    throw authError(422, AUTH_ERROR_CODES.PASSWORD_POLICY_VIOLATION, "Password does not meet policy.", { policyErrors });
  }
  return withTransaction(async (connection) => {
    const existingCount = await repo.countUsers(connection);
    if (existingCount > 0) {
      throw authError(409, "BOOTSTRAP_ADMIN_EXISTS", "Bootstrap is allowed only when no users exist.");
    }
    const passwordHash = await hashPassword(payload.password);
    const user = await repo.insertUser(connection, {
      employeeId: payload.employeeId,
      email: payload.email,
      displayName: payload.displayName,
      passwordHash,
      status: USER_STATUS.PASSWORD_CHANGE_REQUIRED,
      mustChangePassword: true
    });
    const role = await repo.upsertRole(connection, {
      code: "SUPER_ADMIN",
      name: "Super Admin",
      description: "Bootstrap enterprise administrator with full future administrative access.",
      isSystemRole: true
    });
    if (role && role.id) {
      await repo.assignRole(connection, user.id, role.id, user.id);
    }
    await recordSecurityEvent(connection, {
      actorUserId: user.id,
      eventType: SECURITY_EVENTS.BOOTSTRAP_ADMIN_CREATED,
      resourceType: "users",
      resourceId: String(user.id),
      outcome: "SUCCESS",
      metadata: { employeeId: user.employeeId }
    });
    return publicUser(user);
  }, { requestId: context.requestId || "" });
}

module.exports = {
  bootstrapAdmin,
  changePassword,
  clientInfo,
  getAuthConfig,
  identifierHash,
  loadSession,
  login,
  logout,
  publicUser
};
