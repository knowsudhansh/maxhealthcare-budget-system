const { AUTH_ERROR_CODES } = require("./auth.constants");
const { authError } = require("./auth.errors");
const {
  clearSessionCookie,
  parseCookies,
  serializeCookie
} = require("./session");
const {
  changePassword,
  clientInfo,
  getAuthConfig,
  login: loginUser,
  logout: logoutUser,
  publicUser
} = require("./auth.service");
const {
  normalizeChangePasswordPayload,
  normalizeLoginPayload
} = require("./auth.validation");

function runtimeConfig(req) {
  return req.app && req.app.locals ? req.app.locals.runtimeConfig : null;
}

function getSessionToken(req) {
  const config = getAuthConfig(runtimeConfig(req));
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[config.cookieName] || "";
}

function setSessionCookie(req, res, token) {
  const config = getAuthConfig(runtimeConfig(req));
  res.setHeader("Set-Cookie", serializeCookie(config.cookieName, token, {
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAgeSeconds: config.sessionTtlMinutes * 60
  }));
}

function clearCookie(req, res) {
  res.setHeader("Set-Cookie", clearSessionCookie(getAuthConfig(runtimeConfig(req))));
}

function sendSuccess(req, res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req.requestId || ""
  });
}

async function login(req, res, next) {
  try {
    const result = await loginUser(normalizeLoginPayload(req.body || {}), {
      requestId: req.requestId,
      runtimeConfig: runtimeConfig(req),
      clientInfo: clientInfo(req)
    });
    setSessionCookie(req, res, result.token);
    return sendSuccess(req, res, {
      user: result.user,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    await logoutUser(getSessionToken(req), {
      requestId: req.requestId,
      runtimeConfig: runtimeConfig(req),
      clientInfo: clientInfo(req)
    });
    clearCookie(req, res);
    return sendSuccess(req, res, { loggedOut: true });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    if (!req.auth || !req.auth.user) {
      throw authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required.");
    }
    return sendSuccess(req, res, {
      user: publicUser(req.auth.user),
      roles: req.auth.roles || [],
      permissions: req.auth.permissions || [],
      locations: req.auth.locations || []
    });
  } catch (error) {
    return next(error);
  }
}

async function changePasswordHandler(req, res, next) {
  try {
    if (!req.auth || !req.auth.user) {
      throw authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required.");
    }
    const result = await changePassword(req.auth.user, normalizeChangePasswordPayload(req.body || {}), {
      requestId: req.requestId,
      runtimeConfig: runtimeConfig(req),
      clientInfo: clientInfo(req)
    });
    clearCookie(req, res);
    return sendSuccess(req, res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  changePassword: changePasswordHandler,
  login,
  logout,
  me
};
