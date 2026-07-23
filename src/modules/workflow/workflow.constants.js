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

const NEXT_FY_STATES = Object.freeze({
  GENERATED: "GENERATED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED"
});

const TRANSFER_STATES = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  POSTED: "POSTED",
  REVERSED: "REVERSED",
  CANCELLED: "CANCELLED"
});

const WORKFLOW_ACTIONS = Object.freeze({
  CREATE: "CREATE",
  GENERATE: "GENERATE",
  SUBMIT: "SUBMIT",
  START_REVIEW: "START_REVIEW",
  VALIDATE: "VALIDATE",
  APPROVE: "APPROVE",
  LOCK: "LOCK",
  POST: "POST",
  REVERSE: "REVERSE",
  CANCEL: "CANCEL",
  RETURN_TO_DRAFT: "RETURN_TO_DRAFT",
  RETURN_TO_GENERATED: "RETURN_TO_GENERATED",
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

const NEXT_FY_PERMISSIONS = Object.freeze({
  CREATE: "nextfy.create",
  VIEW: "nextfy.view",
  ASSUMPTIONS_MANAGE: "nextfy.assumptions.manage",
  PREVIEW: "nextfy.preview",
  GENERATE: "nextfy.generate",
  RESET: "nextfy.reset",
  ADJUST: "nextfy.adjust",
  REVIEW_START: "nextfy.review.start",
  APPROVE: "nextfy.approve",
  RETURN: "nextfy.return",
  REJECT: "nextfy.reject",
  LOCK: "nextfy.lock",
  EXPORT: "nextfy.export",
  DASHBOARD_VIEW: "nextfy.dashboard.view",
  HISTORY_VIEW: "nextfy.history.view"
});

const TRANSFER_PERMISSIONS = Object.freeze({
  CREATE: "transfer.create",
  VIEW: "transfer.view",
  UPDATE: "transfer.update",
  SUBMIT: "transfer.submit",
  REVIEW_START: "transfer.review.start",
  APPROVE: "transfer.approve",
  RETURN: "transfer.return",
  REJECT: "transfer.reject",
  POST: "transfer.post",
  REVERSE: "transfer.reverse",
  DASHBOARD_VIEW: "transfer.dashboard.view",
  WORKING_BUDGET_VIEW: "transfer.working_budget.view",
  HISTORY_VIEW: "transfer.history.view"
});

const NOTIFICATION_EVENTS = Object.freeze({
  BUDGET_SUBMITTED: "BUDGET_SUBMITTED",
  BUDGET_REVIEW_STARTED: "BUDGET_REVIEW_STARTED",
  BUDGET_APPROVED: "BUDGET_APPROVED",
  BUDGET_RETURNED_TO_DRAFT: "BUDGET_RETURNED_TO_DRAFT",
  BUDGET_REJECTED: "BUDGET_REJECTED",
  BUDGET_LOCKED: "BUDGET_LOCKED",
  NEXT_FY_GENERATED: "NEXT_FY_GENERATED",
  NEXT_FY_REVIEW_STARTED: "NEXT_FY_REVIEW_STARTED",
  NEXT_FY_APPROVED: "NEXT_FY_APPROVED",
  NEXT_FY_RETURNED: "NEXT_FY_RETURNED",
  NEXT_FY_REJECTED: "NEXT_FY_REJECTED",
  NEXT_FY_LOCKED: "NEXT_FY_LOCKED",
  TRANSFER_CREATED: "TRANSFER_CREATED",
  TRANSFER_SUBMITTED: "TRANSFER_SUBMITTED",
  TRANSFER_REVIEW_STARTED: "TRANSFER_REVIEW_STARTED",
  TRANSFER_APPROVED: "TRANSFER_APPROVED",
  TRANSFER_POSTED: "TRANSFER_POSTED",
  TRANSFER_REVERSED: "TRANSFER_REVERSED",
  TRANSFER_REJECTED: "TRANSFER_REJECTED",
  TRANSFER_RETURNED: "TRANSFER_RETURNED"
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
  NEXT_FY_PERMISSIONS,
  NEXT_FY_STATES,
  NOTIFICATION_EVENTS,
  SYSTEM_ACTOR,
  TRANSFER_PERMISSIONS,
  TRANSFER_STATES,
  WORKFLOW_ACTIONS,
  WORKFLOW_PERMISSIONS,
  WORKFLOW_TYPES
};
