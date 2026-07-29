const crypto = require("crypto");

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token, secret) {
  return crypto
    .createHmac("sha256", String(secret || ""))
    .update(String(token || ""))
    .digest("hex");
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index <= 0) return cookies;
      cookies[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.maxAgeSeconds !== undefined) parts.push(`Max-Age=${Math.max(0, Number(options.maxAgeSeconds) || 0)}`);
  return parts.join("; ");
}

function clearSessionCookie(config) {
  return serializeCookie(config.cookieName, "", {
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: config.cookiePath || "/",
    maxAgeSeconds: 0
  });
}

module.exports = {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  parseCookies,
  serializeCookie
};
