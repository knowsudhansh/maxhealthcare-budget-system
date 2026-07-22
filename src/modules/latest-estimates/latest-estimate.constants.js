const LE_MATRIX_STATUSES = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  VALIDATED: "VALIDATED",
  APPROVED: "APPROVED"
});

const LE_VARIANCE_SEVERITIES = Object.freeze({
  ON_BUDGET: "ON_BUDGET",
  WITHIN_THRESHOLD: "WITHIN_THRESHOLD",
  WARNING: "WARNING",
  MATERIAL: "MATERIAL",
  ZERO_BASE_INCREASE: "ZERO_BASE_INCREASE"
});

const LE_PERMISSIONS = Object.freeze({
  MATRIX_CREATE: "le.matrix.create",
  MATRIX_VIEW: "le.matrix.view",
  MATRIX_EDIT: "le.matrix.edit",
  MATRIX_SUBMIT: "le.matrix.submit",
  MATRIX_VALIDATE: "le.matrix.validate",
  MATRIX_APPROVE: "le.matrix.approve",
  MATRIX_RETURN_TO_DRAFT: "le.matrix.return_to_draft",
  MATRIX_REJECT: "le.matrix.reject",
  MATRIX_HISTORY_VIEW: "le.matrix.history.view",
  MATRIX_EXPORT: "le.matrix.export",
  DASHBOARD_VIEW: "le.dashboard.view"
});

module.exports = {
  LE_MATRIX_STATUSES,
  LE_PERMISSIONS,
  LE_VARIANCE_SEVERITIES
};
