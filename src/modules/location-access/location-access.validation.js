const { parsePositiveInteger, sanitizeString } = require("../../validation/common");
const { locationValidationError } = require("./location-access.errors");
const { LOCATION_ACCESS_TYPE, LOCATION_STATUS } = require("./location-access.constants");

const CODE_PATTERN = /^[A-Z0-9._~-]{1,80}$/;
const VALID_ACCESS_TYPES = new Set([
  LOCATION_ACCESS_TYPE.DIRECT,
  LOCATION_ACCESS_TYPE.HIERARCHY,
  LOCATION_ACCESS_TYPE.VIEW_EDIT
]);

function normalizeLocationCode(value) {
  const code = sanitizeString(value, 80).replace(/\s+/g, "-").toUpperCase();
  if (!code || !CODE_PATTERN.test(code)) {
    throw locationValidationError("Location code is invalid.");
  }
  return code;
}

function normalizeLocationName(value) {
  const name = sanitizeString(value, 160);
  if (!name) throw locationValidationError("Location name is required.");
  return name;
}

function normalizeLocationId(value, fieldName = "locationId") {
  return parsePositiveInteger(value, fieldName);
}

function normalizeOptionalLocationId(value, fieldName = "parentLocationId") {
  if (value === null || value === undefined || value === "") return null;
  return normalizeLocationId(value, fieldName);
}

function normalizeAccessType(value) {
  const accessType = sanitizeString(value || LOCATION_ACCESS_TYPE.DIRECT, 40).toUpperCase();
  if (accessType === LOCATION_ACCESS_TYPE.GLOBAL) {
    throw locationValidationError("GLOBAL location access must be granted through permission, not assignment.");
  }
  if (!VALID_ACCESS_TYPES.has(accessType)) {
    throw locationValidationError("Location access type is invalid.");
  }
  return accessType;
}

function normalizeStatus(value) {
  const status = sanitizeString(value || LOCATION_STATUS.ACTIVE, 40).toUpperCase();
  if (!Object.values(LOCATION_STATUS).includes(status)) {
    throw locationValidationError("Location status is invalid.");
  }
  return status;
}

function normalizeOptionalDate(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  const text = sanitizeString(value, 40);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw locationValidationError(`${fieldName} must be a valid date.`);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function rejectUnknownFields(body, allowed) {
  const unknown = Object.keys(body || {}).filter((key) => !allowed.has(key));
  if (unknown.length) throw locationValidationError("Unknown fields are not allowed.");
}

function normalizeLocationPayload(body = {}, options = {}) {
  const allowed = new Set(["code", "name", "status", "parentLocationId", "parent_location_id"]);
  rejectUnknownFields(body, allowed);
  const payload = {};
  if (!options.partial || Object.prototype.hasOwnProperty.call(body, "code")) {
    payload.code = normalizeLocationCode(body.code);
  }
  if (!options.partial || Object.prototype.hasOwnProperty.call(body, "name")) {
    payload.name = normalizeLocationName(body.name);
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    payload.status = normalizeStatus(body.status);
  }
  if (Object.prototype.hasOwnProperty.call(body, "parentLocationId") || Object.prototype.hasOwnProperty.call(body, "parent_location_id")) {
    payload.parentLocationId = normalizeOptionalLocationId(body.parentLocationId || body.parent_location_id);
  }
  return payload;
}

function normalizeAssignmentPayload(body = {}) {
  const allowed = new Set(["locationId", "location_id", "accessType", "access_type", "validFrom", "valid_from", "validUntil", "valid_until", "assignedBy", "assigned_by"]);
  rejectUnknownFields(body, allowed);
  return {
    locationId: normalizeLocationId(body.locationId || body.location_id),
    accessType: normalizeAccessType(body.accessType || body.access_type),
    validFrom: normalizeOptionalDate(body.validFrom || body.valid_from, "validFrom"),
    validUntil: normalizeOptionalDate(body.validUntil || body.valid_until, "validUntil")
  };
}

function normalizeAssignmentsPayload(body = {}) {
  const allowed = new Set(["assignments", "assignedBy", "assigned_by"]);
  rejectUnknownFields(body, allowed);
  if (!Array.isArray(body.assignments)) throw locationValidationError("assignments must be an array.");
  return {
    assignments: body.assignments.map(normalizeAssignmentPayload)
  };
}

function normalizeLocationIdentifier(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw locationValidationError("Location is required.");
  }
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return { type: "id", value: normalizeLocationId(text) };
  return { type: "code", value: normalizeLocationCode(text) };
}

module.exports = {
  normalizeAccessType,
  normalizeAssignmentPayload,
  normalizeAssignmentsPayload,
  normalizeLocationCode,
  normalizeLocationId,
  normalizeLocationIdentifier,
  normalizeLocationPayload,
  normalizeOptionalLocationId,
  normalizeStatus
};
