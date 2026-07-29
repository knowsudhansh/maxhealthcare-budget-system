const { validationError } = require("../../errors/app-error");
const { parsePositiveInteger, sanitizeString } = require("../../validation/common");
const { ALL_PERMISSION_CODES, ROLE_CODES } = require("./rbac.constants");

const ROLE_CODE_PATTERN = /^[A-Z0-9_]{3,80}$/;
const PERMISSION_CODE_SET = new Set(ALL_PERMISSION_CODES);

function normalizeRoleCode(value) {
  const code = sanitizeString(value, 80).toUpperCase();
  if (!ROLE_CODE_PATTERN.test(code)) throw validationError("Role code is invalid.");
  return code;
}

function normalizePermissionCode(value) {
  const code = sanitizeString(value, 120).toLowerCase();
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(code)) throw validationError("Permission code is invalid.");
  return code;
}

function assertKnownPermissionCode(code) {
  const normalized = normalizePermissionCode(code);
  if (!PERMISSION_CODE_SET.has(normalized)) {
    throw validationError("Unknown permission code.");
  }
  return normalized;
}

function normalizeRoleId(value) {
  return parsePositiveInteger(value, "roleId");
}

function normalizeUserId(value) {
  return parsePositiveInteger(value, "userId");
}

function normalizePermissionAssignmentPayload(body = {}) {
  const keys = Object.keys(body);
  const allowed = new Set(["permissionCodes"]);
  const unknown = keys.filter((key) => !allowed.has(key));
  if (unknown.length) throw validationError("Unknown fields are not allowed.");
  if (!Array.isArray(body.permissionCodes)) throw validationError("permissionCodes must be an array.");
  return {
    permissionCodes: Array.from(new Set(body.permissionCodes.map(assertKnownPermissionCode)))
  };
}

function normalizeRoleAssignmentPayload(body = {}) {
  const keys = Object.keys(body);
  const allowed = new Set(["roleIds", "validFrom", "validUntil", "assignedBy"]);
  const unknown = keys.filter((key) => !allowed.has(key));
  if (unknown.length) throw validationError("Unknown fields are not allowed.");
  if (!Array.isArray(body.roleIds)) throw validationError("roleIds must be an array.");
  return {
    roleIds: Array.from(new Set(body.roleIds.map((roleId) => normalizeRoleId(roleId)))),
    validFrom: sanitizeOptionalDate(body.validFrom, "validFrom"),
    validUntil: sanitizeOptionalDate(body.validUntil, "validUntil")
  };
}

function normalizeRolePayload(body = {}) {
  const keys = Object.keys(body);
  const allowed = new Set(["code", "name", "description"]);
  const unknown = keys.filter((key) => !allowed.has(key));
  if (unknown.length) throw validationError("Unknown fields are not allowed.");
  const code = normalizeRoleCode(body.code);
  if (Object.prototype.hasOwnProperty.call(ROLE_CODES, code)) {
    throw validationError("System role codes cannot be created through this endpoint.");
  }
  const name = sanitizeString(body.name, 160);
  if (!name) throw validationError("Role name is required.");
  return {
    code,
    name,
    description: sanitizeString(body.description || "", 1000)
  };
}

function sanitizeOptionalDate(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  const text = sanitizeString(value, 40);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw validationError(`${fieldName} must be a valid date.`);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  assertKnownPermissionCode,
  normalizePermissionAssignmentPayload,
  normalizePermissionCode,
  normalizeRoleAssignmentPayload,
  normalizeRoleCode,
  normalizeRoleId,
  normalizeRolePayload,
  normalizeUserId
};
