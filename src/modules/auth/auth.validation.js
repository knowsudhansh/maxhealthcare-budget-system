const { validationError } = require("../../errors/app-error");
const { sanitizeString, parsePositiveInteger } = require("../../validation/common");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeIdentifier(value) {
  const identifier = sanitizeString(value, 180).toLowerCase();
  if (!identifier) throw validationError("Employee ID or email is required.");
  return identifier;
}

function normalizeEmail(value) {
  const email = sanitizeString(value, 180).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw validationError("Email is invalid.");
  return email;
}

function normalizeEmployeeId(value) {
  const employeeId = sanitizeString(value, 80);
  if (!/^[A-Za-z0-9._-]{2,80}$/.test(employeeId)) {
    throw validationError("Employee ID is invalid.");
  }
  return employeeId;
}

function normalizeLoginPayload(body = {}) {
  const identifier = normalizeIdentifier(body.identifier || body.employeeId || body.employee_id || body.email);
  const password = String(body.password || "");
  if (!password) throw validationError("Password is required.");
  return { identifier, password };
}

function normalizeChangePasswordPayload(body = {}) {
  const currentPassword = String(body.currentPassword || body.current_password || "");
  const newPassword = String(body.newPassword || body.new_password || "");
  if (!currentPassword) throw validationError("Current password is required.");
  if (!newPassword) throw validationError("New password is required.");
  return { currentPassword, newPassword };
}

function normalizeBootstrapAdminPayload(input = {}) {
  return {
    employeeId: normalizeEmployeeId(input.employeeId || input.employee_id),
    email: normalizeEmail(input.email),
    displayName: sanitizeString(input.displayName || input.display_name, 180),
    password: String(input.password || "")
  };
}

function normalizeUserId(value) {
  return parsePositiveInteger(value, "userId");
}

module.exports = {
  normalizeBootstrapAdminPayload,
  normalizeChangePasswordPayload,
  normalizeEmail,
  normalizeEmployeeId,
  normalizeIdentifier,
  normalizeLoginPayload,
  normalizeUserId
};
