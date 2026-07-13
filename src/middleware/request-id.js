const crypto = require("crypto");

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,80}$/;

function createRequestId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function requestIdMiddleware(req, res, next) {
  const inbound = String(req.headers["x-request-id"] || "").trim();
  const requestId = SAFE_REQUEST_ID.test(inbound) ? inbound : createRequestId();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

module.exports = {
  SAFE_REQUEST_ID,
  createRequestId,
  requestIdMiddleware
};
