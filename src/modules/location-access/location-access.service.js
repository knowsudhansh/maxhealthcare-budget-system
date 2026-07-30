const { getPool } = require("../../db/pool");
const { withTransaction } = require("../../db/transaction");
const authRepo = require("../auth/auth.repository");
const { ROLE_CODES } = require("../rbac/rbac.constants");
const { hasSuperAdmin } = require("../rbac/rbac.service");
const {
  LOCATION_ACCESS_TYPE,
  LOCATION_AUDIT_EVENTS,
  LOCATION_SCOPE_MODE,
  LOCATION_STATUS
} = require("./location-access.constants");
const {
  locationAccessDenied,
  locationNotFound,
  locationValidationError
} = require("./location-access.errors");
const {
  normalizeAccessType,
  normalizeLocationCode,
  normalizeLocationIdentifier
} = require("./location-access.validation");
const repo = require("./location-access.repository");

function actorId(auth) {
  return auth && auth.user && auth.user.id ? auth.user.id : null;
}

function hasGlobalLocationAccess(auth) {
  return Boolean(
    auth &&
      Array.isArray(auth.permissions) &&
      auth.permissions.includes("location.access_all")
  );
}

function normalizeLegacyAccessType(accessType) {
  const normalized = String(accessType || "").trim().toUpperCase();
  if (normalized === LOCATION_ACCESS_TYPE.VIEW_EDIT) return LOCATION_ACCESS_TYPE.DIRECT;
  if (normalized === LOCATION_ACCESS_TYPE.HIERARCHY) return LOCATION_ACCESS_TYPE.HIERARCHY;
  if (normalized === LOCATION_ACCESS_TYPE.DIRECT) return LOCATION_ACCESS_TYPE.DIRECT;
  return LOCATION_ACCESS_TYPE.DIRECT;
}

function publicLocation(location) {
  if (!location) return null;
  return {
    id: location.id,
    code: location.code,
    name: location.name,
    status: location.status,
    parentLocationId: location.parentLocationId
  };
}

async function auditLocationEvent(db, event) {
  try {
    await authRepo.insertSecurityAuditEvent(db, event);
  } catch (_error) {
    // Do not expose audit-table availability to callers.
  }
}

function buildChildrenMap(locations) {
  const children = new Map();
  locations.forEach((location) => {
    const parentId = location.parentLocationId || 0;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(location);
  });
  return children;
}

function collectDescendants(locationId, childrenMap, path = new Set()) {
  if (path.has(locationId)) {
    throw locationValidationError("Location hierarchy cycle detected.");
  }
  const nextPath = new Set(path);
  nextPath.add(locationId);
  const descendants = [];
  (childrenMap.get(locationId) || []).forEach((child) => {
    descendants.push(child.id);
    descendants.push(...collectDescendants(child.id, childrenMap, nextPath));
  });
  return descendants;
}

async function resolveLocationDescendants(locationId, db = getPool()) {
  const locations = await repo.listLocations(db, { activeOnly: true });
  const childrenMap = buildChildrenMap(locations);
  return Array.from(new Set(collectDescendants(Number(locationId), childrenMap)));
}

async function validateLocationHierarchyChange(locationId, parentLocationId, db = getPool()) {
  if (parentLocationId === null || parentLocationId === undefined) return true;
  if (Number(locationId) === Number(parentLocationId)) {
    throw locationValidationError("A location cannot be its own parent.");
  }
  const parent = await repo.findLocationById(db, parentLocationId);
  if (!parent || parent.status !== LOCATION_STATUS.ACTIVE) {
    throw locationValidationError("Parent location must be active.");
  }
  const descendants = await resolveLocationDescendants(locationId, db);
  if (descendants.includes(Number(parentLocationId))) {
    throw locationValidationError("Location parent would create a hierarchy cycle.");
  }
  return true;
}

async function resolveUserLocationScope(userId, auth = null, db = getPool()) {
  if (!userId) {
    return emptyScope();
  }
  if (hasGlobalLocationAccess(auth)) {
    const locations = await repo.listLocations(db, { activeOnly: true });
    return {
      mode: LOCATION_SCOPE_MODE.GLOBAL,
      directLocationIds: [],
      effectiveLocationIds: locations.map((location) => location.id),
      effectiveLocationCodes: locations.map((location) => location.code),
      assignments: []
    };
  }
  const assignments = await repo.listActiveAssignmentsForUser(db, userId);
  if (!assignments.length) return emptyScope();
  const locations = await repo.listLocations(db, { activeOnly: true });
  const byId = new Map(locations.map((location) => [location.id, location]));
  const childrenMap = buildChildrenMap(locations);
  const directLocationIds = [];
  const effectiveIds = new Set();
  assignments.forEach((assignment) => {
    if (!byId.has(assignment.locationId)) return;
    directLocationIds.push(assignment.locationId);
    effectiveIds.add(assignment.locationId);
    if (normalizeLegacyAccessType(assignment.accessType) === LOCATION_ACCESS_TYPE.HIERARCHY) {
      collectDescendants(assignment.locationId, childrenMap).forEach((id) => effectiveIds.add(id));
    }
  });
  const effectiveLocations = Array.from(effectiveIds)
    .map((id) => byId.get(id))
    .filter(Boolean);
  return {
    mode: effectiveLocations.length ? LOCATION_SCOPE_MODE.RESTRICTED : LOCATION_SCOPE_MODE.NONE,
    directLocationIds: Array.from(new Set(directLocationIds)),
    effectiveLocationIds: effectiveLocations.map((location) => location.id),
    effectiveLocationCodes: effectiveLocations.map((location) => location.code),
    assignments: assignments.map((assignment) => ({
      locationId: assignment.locationId,
      locationCode: assignment.locationCode,
      accessType: normalizeLegacyAccessType(assignment.accessType),
      validFrom: assignment.validFrom,
      validUntil: assignment.validUntil
    }))
  };
}

function emptyScope() {
  return {
    mode: LOCATION_SCOPE_MODE.NONE,
    directLocationIds: [],
    effectiveLocationIds: [],
    effectiveLocationCodes: [],
    assignments: []
  };
}

async function resolveLocationIdentifier(identifier, db = getPool()) {
  const normalized = normalizeLocationIdentifier(identifier);
  const location = normalized.type === "id"
    ? await repo.findLocationById(db, normalized.value)
    : await repo.findLocationByCode(db, normalized.value);
  if (!location) throw locationNotFound();
  if (location.status !== LOCATION_STATUS.ACTIVE) throw locationAccessDenied();
  return location;
}

async function canAccessLocation(auth, identifier, db = getPool()) {
  if (!auth || !auth.user) return false;
  const location = await resolveLocationIdentifier(identifier, db);
  const scope = auth.locationScope || await resolveUserLocationScope(auth.user.id, auth, db);
  if (scope.mode === LOCATION_SCOPE_MODE.GLOBAL) return true;
  return scope.effectiveLocationIds.includes(location.id) || scope.effectiveLocationCodes.includes(location.code);
}

async function assertLocationAccess(auth, identifier, db = getPool()) {
  if (!await canAccessLocation(auth, identifier, db)) {
    throw locationAccessDenied();
  }
  return true;
}

async function assertAllLocationsAccess(auth, identifiers, db = getPool()) {
  const values = Array.isArray(identifiers) ? identifiers : [identifiers];
  for (const value of values) {
    await assertLocationAccess(auth, value, db);
  }
  return true;
}

async function filterRequestedLocations(auth, requestedLocations, db = getPool()) {
  const values = (Array.isArray(requestedLocations) ? requestedLocations : [requestedLocations]).filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
  if (!auth || !auth.user) return [];
  const scope = auth.locationScope || await resolveUserLocationScope(auth.user.id, auth, db);
  if (scope.mode === LOCATION_SCOPE_MODE.NONE) return [];
  if (!values.length) return scope.effectiveLocationCodes;
  const allowed = [];
  for (const value of values) {
    try {
      const location = await resolveLocationIdentifier(value, db);
      if (scope.mode === LOCATION_SCOPE_MODE.GLOBAL || scope.effectiveLocationIds.includes(location.id)) {
        allowed.push(location.code);
      }
    } catch (_error) {
      // Unknown requested filters are not included in safe read intersections.
    }
  }
  return Array.from(new Set(allowed));
}

async function listLocations() {
  return (await repo.listLocations(getPool())).map(publicLocation);
}

async function getLocation(locationId) {
  const location = await repo.findLocationById(getPool(), locationId);
  if (!location) throw locationNotFound();
  return publicLocation(location);
}

async function createLocation(payload, context = {}) {
  return withTransaction(async (connection) => {
    const existing = await repo.findLocationByCode(connection, payload.code);
    if (existing) throw locationValidationError("Location code already exists.");
    if (payload.parentLocationId) {
      const parent = await repo.findLocationById(connection, payload.parentLocationId);
      if (!parent || parent.status !== LOCATION_STATUS.ACTIVE) {
        throw locationValidationError("Parent location must be active.");
      }
    }
    const location = await repo.createLocation(connection, payload);
    await auditLocationEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: LOCATION_AUDIT_EVENTS.LOCATION_CREATED,
      resourceType: "locations",
      resourceId: String(location.id),
      outcome: "SUCCESS",
      metadata: { code: location.code }
    });
    return publicLocation(location);
  }, { requestId: context.requestId || "" });
}

async function updateLocation(locationId, payload, context = {}) {
  return withTransaction(async (connection) => {
    const current = await repo.findLocationById(connection, locationId);
    if (!current) throw locationNotFound();
    if (payload.code && payload.code !== current.code) {
      const existing = await repo.findLocationByCode(connection, payload.code);
      if (existing && existing.id !== current.id) throw locationValidationError("Location code already exists.");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "parentLocationId")) {
      try {
        await validateLocationHierarchyChange(locationId, payload.parentLocationId, connection);
      } catch (error) {
        await auditLocationEvent(connection, {
          actorUserId: actorId(context.auth),
          eventType: LOCATION_AUDIT_EVENTS.LOCATION_HIERARCHY_CYCLE_BLOCKED,
          resourceType: "locations",
          resourceId: String(locationId),
          outcome: "DENIED",
          metadata: { reason: error.publicCode || "LOCATION_VALIDATION_ERROR" }
        });
        throw error;
      }
    }
    const updated = await repo.updateLocation(connection, locationId, payload);
    await auditLocationEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: updated.status === LOCATION_STATUS.DISABLED ? LOCATION_AUDIT_EVENTS.LOCATION_DISABLED : LOCATION_AUDIT_EVENTS.LOCATION_UPDATED,
      resourceType: "locations",
      resourceId: String(locationId),
      outcome: "SUCCESS",
      metadata: { code: updated.code, status: updated.status }
    });
    return publicLocation(updated);
  }, { requestId: context.requestId || "" });
}

async function listUserAssignments(userId) {
  return repo.listAssignmentsForUser(getPool(), userId);
}

async function assertCanAssignLocations(assignments, context, db) {
  if (hasSuperAdmin(context.auth)) return;
  if (hasGlobalLocationAccess(context.auth)) return;
  for (const assignment of assignments) {
    if (assignment.accessType === LOCATION_ACCESS_TYPE.GLOBAL) {
      throw locationAccessDenied("Global location access cannot be assigned through user-location assignments.");
    }
    if (!await canAccessLocation(context.auth, assignment.locationId, db)) {
      await auditLocationEvent(db, {
        actorUserId: actorId(context.auth),
        eventType: LOCATION_AUDIT_EVENTS.LOCATION_ASSIGNMENT_DENIED,
        resourceType: "user_locations",
        resourceId: String(assignment.locationId),
        outcome: "DENIED",
        metadata: { reason: "scope_expansion_blocked" }
      });
      throw locationAccessDenied("You cannot assign locations outside your scope.");
    }
  }
}

async function replaceUserAssignments(userId, assignments, context = {}) {
  return withTransaction(async (connection) => {
    for (const assignment of assignments) {
      const location = await repo.findLocationById(connection, assignment.locationId);
      if (!location || location.status !== LOCATION_STATUS.ACTIVE) throw locationValidationError("Assigned location must be active.");
      normalizeAccessType(assignment.accessType);
    }
    await assertCanAssignLocations(assignments, context, connection);
    await repo.replaceAssignmentsForUser(connection, userId, assignments, actorId(context.auth));
    await auditLocationEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: LOCATION_AUDIT_EVENTS.USER_LOCATIONS_REPLACED,
      resourceType: "users",
      resourceId: String(userId),
      outcome: "SUCCESS",
      metadata: { assignmentCount: assignments.length }
    });
    return repo.listAssignmentsForUser(connection, userId);
  }, { requestId: context.requestId || "" });
}

async function addUserAssignment(userId, assignment, context = {}) {
  return withTransaction(async (connection) => {
    const location = await repo.findLocationById(connection, assignment.locationId);
    if (!location || location.status !== LOCATION_STATUS.ACTIVE) throw locationValidationError("Assigned location must be active.");
    await assertCanAssignLocations([assignment], context, connection);
    await repo.upsertAssignment(connection, userId, assignment, actorId(context.auth));
    await auditLocationEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: LOCATION_AUDIT_EVENTS.USER_LOCATION_ASSIGNED,
      resourceType: "users",
      resourceId: String(userId),
      outcome: "SUCCESS",
      metadata: { locationId: assignment.locationId, accessType: assignment.accessType }
    });
    return repo.listAssignmentsForUser(connection, userId);
  }, { requestId: context.requestId || "" });
}

function parseAssignmentId(assignmentId) {
  const parts = String(assignmentId || "").split(":");
  if (parts.length !== 3) throw locationValidationError("Assignment identifier is invalid.");
  return {
    userId: Number(parts[0]),
    locationId: Number(parts[1]),
    accessType: normalizeAccessType(parts[2])
  };
}

async function removeUserAssignment(userId, assignmentId, context = {}) {
  return withTransaction(async (connection) => {
    const parsed = parseAssignmentId(assignmentId);
    if (parsed.userId !== Number(userId)) throw locationValidationError("Assignment identifier is invalid.");
    await repo.deleteAssignment(connection, userId, parsed.locationId, parsed.accessType);
    await auditLocationEvent(connection, {
      actorUserId: actorId(context.auth),
      eventType: LOCATION_AUDIT_EVENTS.USER_LOCATION_REMOVED,
      resourceType: "users",
      resourceId: String(userId),
      outcome: "SUCCESS",
      metadata: { locationId: parsed.locationId, accessType: parsed.accessType }
    });
    return { removed: true };
  }, { requestId: context.requestId || "" });
}

function locationTree(locations) {
  const byParent = buildChildrenMap(locations);
  function node(location) {
    return Object.assign(publicLocation(location), {
      children: (byParent.get(location.id) || []).map(node)
    });
  }
  return (byParent.get(0) || []).map(node);
}

async function getLocationTree() {
  return locationTree(await repo.listLocations(getPool()));
}

module.exports = {
  addUserAssignment,
  assertAllLocationsAccess,
  assertLocationAccess,
  canAccessLocation,
  createLocation,
  filterRequestedLocations,
  getLocation,
  getLocationTree,
  hasGlobalLocationAccess,
  listLocations,
  listUserAssignments,
  removeUserAssignment,
  replaceUserAssignments,
  resolveLocationDescendants,
  resolveLocationIdentifier,
  resolveUserLocationScope,
  updateLocation,
  validateLocationHierarchyChange
};
