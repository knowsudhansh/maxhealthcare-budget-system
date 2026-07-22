const { AppError } = require("../../errors/app-error");

const WORKFLOW_ERROR_CODES = Object.freeze({
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  INVALID_WORKFLOW_TRANSITION: "INVALID_WORKFLOW_TRANSITION",
  WORKFLOW_VERSION_CONFLICT: "WORKFLOW_VERSION_CONFLICT",
  WORKFLOW_ALREADY_LOCKED: "WORKFLOW_ALREADY_LOCKED",
  WORKFLOW_REMARKS_REQUIRED: "WORKFLOW_REMARKS_REQUIRED",
  DUPLICATE_WORKFLOW_ACTION: "DUPLICATE_WORKFLOW_ACTION",
  INVALID_WORKFLOW_ENTITY: "INVALID_WORKFLOW_ENTITY"
});

function workflowError(statusCode, publicCode, publicMessage, details) {
  return new AppError({
    statusCode,
    publicCode,
    publicMessage,
    details
  });
}

module.exports = {
  WORKFLOW_ERROR_CODES,
  workflowError
};
