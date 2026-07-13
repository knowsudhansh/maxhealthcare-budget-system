const { AppError, ERROR_CODES } = require("../errors/app-error");

function mysqlErrorToAppError(error) {
  if (!error || error instanceof AppError) return error;

  if (error.code === "ER_DUP_ENTRY") {
    return new AppError({
      statusCode: 409,
      publicCode: ERROR_CODES.DUPLICATE_RECORD,
      publicMessage: "Duplicate record."
    });
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_ROW_IS_REFERENCED_2") {
    return new AppError({
      statusCode: 422,
      publicCode: ERROR_CODES.VALIDATION_ERROR,
      publicMessage: "Related record validation failed."
    });
  }

  if (
    ["PROTOCOL_CONNECTION_LOST", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH"].includes(error.code)
  ) {
    return new AppError({
      statusCode: 503,
      publicCode: ERROR_CODES.DATABASE_UNAVAILABLE,
      publicMessage: "Database is unavailable."
    });
  }

  if (error.code === "ER_LOCK_DEADLOCK" || error.code === "ER_LOCK_WAIT_TIMEOUT") {
    return new AppError({
      statusCode: 409,
      publicCode: ERROR_CODES.RECORD_CONFLICT,
      publicMessage: "Database record is busy. Please retry."
    });
  }

  return error;
}

function toPublicError(error) {
  const mapped = mysqlErrorToAppError(error);
  if (mapped instanceof AppError) return mapped;
  return new AppError({
    statusCode: 500,
    publicCode: ERROR_CODES.INTERNAL_ERROR,
    publicMessage: "Internal server error.",
    cause: error
  });
}

function errorHandler(error, req, res, _next) {
  const publicError = toPublicError(error);
  res.locals.errorCode = publicError.publicCode;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: publicError.statusCode >= 500 ? "error" : "warn",
    requestId: req.requestId || "",
    method: req.method,
    path: req.path,
    statusCode: publicError.statusCode,
    errorCode: publicError.publicCode,
    message: publicError.publicMessage
  };

  if ((process.env.APP_ENV || "").toLowerCase() === "development") {
    logEntry.internalCode = error && error.code ? error.code : undefined;
  }

  console.error(JSON.stringify(logEntry));

  return res.status(publicError.statusCode).json({
    success: false,
    error: {
      code: publicError.publicCode,
      message: publicError.publicMessage,
      requestId: req.requestId || ""
    }
  });
}

module.exports = {
  errorHandler,
  mysqlErrorToAppError,
  toPublicError
};
