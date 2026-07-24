const { AUTH_ERROR_CODES } = require("../modules/auth/auth.constants");
const { authError } = require("../modules/auth/auth.errors");
const { getAuthConfig, loadSession } = require("../modules/auth/auth.service");
const { parseCookies } = require("../modules/auth/session");

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
      req.auth = {
        sessionId: session.id,
        user: session.user,
        roles: [],
        permissions: [],
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

module.exports = {
  optionalAuthentication,
  requireAuthentication,
  sessionTokenFromRequest
};
