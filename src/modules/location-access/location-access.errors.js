const { AppError } = require("../../errors/app-error");

function locationAccessDenied(message = "You do not have access to the requested location.") {
  return new AppError({
    statusCode: 403,
    publicCode: "LOCATION_ACCESS_DENIED",
    publicMessage: message
  });
}

function locationValidationError(message = "Invalid location request.") {
  return new AppError({
    statusCode: 400,
    publicCode: "LOCATION_VALIDATION_ERROR",
    publicMessage: message
  });
}

function locationNotFound(message = "Location not found.") {
  return new AppError({
    statusCode: 404,
    publicCode: "LOCATION_NOT_FOUND",
    publicMessage: message
  });
}

module.exports = {
  locationAccessDenied,
  locationNotFound,
  locationValidationError
};
