const { clientInfo } = require("../auth/auth.service");
const {
  addUserAssignment,
  createLocation,
  getLocation,
  getLocationTree,
  listLocations,
  listUserAssignments,
  removeUserAssignment,
  replaceUserAssignments,
  updateLocation
} = require("./location-access.service");
const {
  normalizeAssignmentPayload,
  normalizeAssignmentsPayload,
  normalizeLocationId,
  normalizeLocationPayload
} = require("./location-access.validation");
const { normalizeUserId } = require("../rbac/rbac.validation");

function success(req, res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req.requestId || ""
  });
}

function context(req) {
  return {
    requestId: req.requestId,
    auth: req.auth,
    clientInfo: clientInfo(req)
  };
}

async function locations(req, res, next) {
  try {
    return success(req, res, { locations: await listLocations() });
  } catch (error) {
    return next(error);
  }
}

async function tree(req, res, next) {
  try {
    return success(req, res, { locations: await getLocationTree() });
  } catch (error) {
    return next(error);
  }
}

async function location(req, res, next) {
  try {
    return success(req, res, { location: await getLocation(normalizeLocationId(req.params.locationId)) });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const payload = normalizeLocationPayload(req.body || {});
    return success(req, res, { location: await createLocation(payload, context(req)) }, 201);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const payload = normalizeLocationPayload(req.body || {}, { partial: true });
    return success(req, res, { location: await updateLocation(normalizeLocationId(req.params.locationId), payload, context(req)) });
  } catch (error) {
    return next(error);
  }
}

async function myScope(req, res, next) {
  try {
    return success(req, res, { locationScope: req.auth ? req.auth.locationScope : null });
  } catch (error) {
    return next(error);
  }
}

async function userAssignments(req, res, next) {
  try {
    return success(req, res, { assignments: await listUserAssignments(normalizeUserId(req.params.userId)) });
  } catch (error) {
    return next(error);
  }
}

async function replaceAssignments(req, res, next) {
  try {
    const userId = normalizeUserId(req.params.userId);
    const payload = normalizeAssignmentsPayload(req.body || {});
    return success(req, res, {
      assignments: await replaceUserAssignments(userId, payload.assignments, context(req))
    });
  } catch (error) {
    return next(error);
  }
}

async function addAssignment(req, res, next) {
  try {
    const userId = normalizeUserId(req.params.userId);
    const assignment = normalizeAssignmentPayload(req.body || {});
    return success(req, res, {
      assignments: await addUserAssignment(userId, assignment, context(req))
    }, 201);
  } catch (error) {
    return next(error);
  }
}

async function removeAssignment(req, res, next) {
  try {
    const userId = normalizeUserId(req.params.userId);
    return success(req, res, await removeUserAssignment(userId, req.params.assignmentId, context(req)));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addAssignment,
  create,
  location,
  locations,
  myScope,
  removeAssignment,
  replaceAssignments,
  tree,
  update,
  userAssignments
};
