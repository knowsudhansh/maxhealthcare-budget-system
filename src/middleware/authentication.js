const { AUTH_ERROR_CODES } = require("../modules/auth/auth.constants");
const { authError } = require("../modules/auth/auth.errors");
const { getAuthConfig, loadSession } = require("../modules/auth/auth.service");
const { parseCookies } = require("../modules/auth/session");
const {
  assertKnownPermission,
  forbiddenError,
  resolveAuthorizationContext
} = require("../modules/rbac/rbac.service");

function sessionTokenFromRequest(req) {
  const config = getAuthConfig(req.app && req.app.locals ? req.app.locals.runtimeConfig : null);
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[config.cookieName] || "";
}

async function optionalAuthentication(req, _res, next) {
  try {
    const token = sessionTokenFromRequest(req);
    const session = await loadSession(token, req.app && req.app.locals ? req.app.locals.runtimeConfig : null);
    if (session) {
      const authorization = await resolveAuthorizationContext(session.user);
      req.auth = {
        sessionId: session.id,
        user: session.user,
        roles: authorization ? authorization.roles : [],
        permissions: authorization ? authorization.permissions : [],
        locations: []
      };
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuthentication(req, _res, next) {
  if (!req.auth || !req.auth.user) {
    return next(authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required."));
  }
  return next();
}

function requirePermission(permissionCode) {
  assertKnownPermission(permissionCode);
  return function requirePermissionMiddleware(req, _res, next) {
    if (!req.auth || !req.auth.user) {
      return next(authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required."));
    }
    if (!Array.isArray(req.auth.permissions) || !req.auth.permissions.includes(permissionCode)) {
      return next(forbiddenError());
    }
    return next();
  };
}

function requireAnyPermission(permissionCodes) {
  const codes = permissionCodes.map((code) => {
    assertKnownPermission(code);
    return code;
  });
  return function requireAnyPermissionMiddleware(req, _res, next) {
    if (!req.auth || !req.auth.user) {
      return next(authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required."));
    }
    if (!Array.isArray(req.auth.permissions) || !codes.some((code) => req.auth.permissions.includes(code))) {
      return next(forbiddenError());
    }
    return next();
  };
}

function requireAllPermissions(permissionCodes) {
  const codes = permissionCodes.map((code) => {
    assertKnownPermission(code);
    return code;
  });
  return function requireAllPermissionsMiddleware(req, _res, next) {
    if (!req.auth || !req.auth.user) {
      return next(authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required."));
    }
    if (!Array.isArray(req.auth.permissions) || !codes.every((code) => req.auth.permissions.includes(code))) {
      return next(forbiddenError());
    }
    return next();
  };
}

module.exports = {
  optionalAuthentication,
  requireAllPermissions,
  requireAnyPermission,
  requireAuthentication,
  requirePermission,
  sessionTokenFromRequest
};
