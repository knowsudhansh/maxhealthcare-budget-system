const { AUTH_ERROR_CODES } = require("../modules/auth/auth.constants");
const { authError } = require("../modules/auth/auth.errors");
const {
  assertAllLocationsAccess,
  assertLocationAccess,
  filterRequestedLocations,
  hasGlobalLocationAccess
} = require("../modules/location-access/location-access.service");
const { locationAccessDenied, locationValidationError } = require("../modules/location-access/location-access.errors");

function requireAuthenticated(req) {
  if (!req.auth || !req.auth.user) {
    throw authError(401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, "Authentication required.");
  }
}

function valueAt(source, key) {
  if (!source || !key) return undefined;
  return key.split(".").reduce((value, part) => (value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined), source);
}

function collectLocations(req, options) {
  const values = [];
  (options.params || []).forEach((key) => values.push(valueAt(req.params, key)));
  (options.query || []).forEach((key) => values.push(valueAt(req.query, key)));
  (options.body || []).forEach((key) => values.push(valueAt(req.body, key)));
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function requireLocationAccess(options = {}) {
  return async function requireLocationAccessMiddleware(req, _res, next) {
    try {
      requireAuthenticated(req);
      const values = collectLocations(req, options);
      if (!values.length && options.required !== false) throw locationValidationError("Location is required.");
      if (options.all === false) {
        const allowed = await filterRequestedLocations(req.auth, values);
        if (!allowed.length) throw locationAccessDenied();
      } else {
        await assertAllLocationsAccess(req.auth, values);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireAnyLocationAccess() {
  return async function requireAnyLocationAccessMiddleware(req, _res, next) {
    try {
      requireAuthenticated(req);
      if (hasGlobalLocationAccess(req.auth)) return next();
      if (req.auth.locationScope && req.auth.locationScope.effectiveLocationIds.length) return next();
      throw locationAccessDenied();
    } catch (error) {
      return next(error);
    }
  };
}

function requireGlobalLocationAccess() {
  return function requireGlobalLocationAccessMiddleware(req, _res, next) {
    try {
      requireAuthenticated(req);
      if (!hasGlobalLocationAccess(req.auth)) throw locationAccessDenied("Global location access is required.");
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireResourceLocationAccess(resourceLoader, options = {}) {
  if (typeof resourceLoader !== "function") throw new Error("resourceLoader is required.");
  return async function requireResourceLocationAccessMiddleware(req, _res, next) {
    try {
      requireAuthenticated(req);
      const resource = await resourceLoader(req);
      if (!resource && options.hideMissing) return next();
      if (!resource) throw locationValidationError("Resource location could not be resolved.");
      const value = resource.locationId || resource.locationCode || resource.location;
      await assertLocationAccess(req.auth, value);
      req.locationProtectedResource = resource;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  collectLocations,
  requireAnyLocationAccess,
  requireGlobalLocationAccess,
  requireLocationAccess,
  requireResourceLocationAccess
};
