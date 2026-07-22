const WORKFLOW_TYPES = Object.freeze({
  BUDGET: "BUDGET",
  LE: "LE",
  NEXT_FY: "NEXT_FY",
  TRANSFER: "TRANSFER"
});

const ENTITY_TYPES = Object.freeze({
  BUDGET_SUBMISSION: "BUDGET_SUBMISSION",
  BUDGET_CYCLE: "BUDGET_CYCLE",
  LE_MATRIX: "LE_MATRIX",
  NEXT_FY_BUDGET: "NEXT_FY_BUDGET",
  TRANSFER: "TRANSFER"
});

const BUDGET_STATES = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED"
});

const LE_STATES = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  VALIDATED: "VALIDATED",
  APPROVED: "APPROVED"
});

const WORKFLOW_ACTIONS = Object.freeze({
  CREATE: "CREATE",
  SUBMIT: "SUBMIT",
  START_REVIEW: "START_REVIEW",
  VALIDATE: "VALIDATE",
  APPROVE: "APPROVE",
  LOCK: "LOCK",
  RETURN_TO_DRAFT: "RETURN_TO_DRAFT",
  REJECT: "REJECT"
});

const DEFAULT_WORKFLOW_STATUS = Object.freeze({
  currentState: "NOT_STARTED",
  versionNumber: null,
  isLocked: false,
  label: "Not Started"
});

const WORKFLOW_PERMISSIONS = Object.freeze({
  START: "budget.workflow.start",
  SUBMIT: "budget.submit",
  START_REVIEW: "budget.review.start",
  APPROVE: "budget.approve",
  RETURN_TO_DRAFT: "budget.return_to_draft",
  REJECT: "budget.reject",
  LOCK: "budget.lock",
  VIEW: "budget.workflow.view",
  HISTORY_VIEW: "budget.workflow.history.view",
  APPROVAL_QUEUE_VIEW: "budget.approval_queue.view"
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

const NOTIFICATION_EVENTS = Object.freeze({
  BUDGET_SUBMITTED: "BUDGET_SUBMITTED",
  BUDGET_REVIEW_STARTED: "BUDGET_REVIEW_STARTED",
  BUDGET_APPROVED: "BUDGET_APPROVED",
  BUDGET_RETURNED_TO_DRAFT: "BUDGET_RETURNED_TO_DRAFT",
  BUDGET_REJECTED: "BUDGET_REJECTED",
  BUDGET_LOCKED: "BUDGET_LOCKED"
});

const SYSTEM_ACTOR = Object.freeze({
  actorType: "SYSTEM",
  actorId: null,
  displayName: "system"
});

module.exports = {
  BUDGET_STATES,
  DEFAULT_WORKFLOW_STATUS,
  ENTITY_TYPES,
  LE_PERMISSIONS,
  LE_STATES,
  NOTIFICATION_EVENTS,
  SYSTEM_ACTOR,
  WORKFLOW_ACTIONS,
  WORKFLOW_PERMISSIONS,
  WORKFLOW_TYPES
};
