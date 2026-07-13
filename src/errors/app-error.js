const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  RECORD_CONFLICT: "RECORD_CONFLICT",
  DUPLICATE_RECORD: "DUPLICATE_RECORD",
  ALLOCATION_TOTAL_INVALID: "ALLOCATION_TOTAL_INVALID",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  DEPENDENCY_UNAVAILABLE: "DEPENDENCY_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR"
};

class AppError extends Error {
  constructor({
    statusCode = 500,
    publicCode = ERROR_CODES.INTERNAL_ERROR,
    publicMessage = "Something went wrong.",
    details,
    cause
  } = {}) {
    super(publicMessage);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.publicCode = publicCode;
    this.publicMessage = publicMessage;
    this.details = details;
    this.cause = cause;
  }
}

function validationError(message = "Invalid request.", details) {
  return new AppError({
    statusCode: 400,
    publicCode: ERROR_CODES.VALIDATION_ERROR,
    publicMessage: message,
    details
  });
}

function notFoundError(message = "Record not found.") {
  return new AppError({
    statusCode: 404,
    publicCode: ERROR_CODES.RECORD_NOT_FOUND,
    publicMessage: message
  });
}

function conflictError(message = "This record was changed by another user.") {
  return new AppError({
    statusCode: 409,
    publicCode: ERROR_CODES.RECORD_CONFLICT,
    publicMessage: message
  });
}

module.exports = {
  AppError,
  ERROR_CODES,
  conflictError,
  notFoundError,
  validationError
};
