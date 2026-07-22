const { BUDGET_STATES, LE_STATES, WORKFLOW_ACTIONS, WORKFLOW_TYPES } = require("./workflow.constants");
const { WORKFLOW_ERROR_CODES, workflowError } = require("./workflow.errors");

const BUDGET_TRANSITIONS = Object.freeze({
  [BUDGET_STATES.DRAFT]: Object.freeze({
    [WORKFLOW_ACTIONS.SUBMIT]: BUDGET_STATES.SUBMITTED
  }),
  [BUDGET_STATES.SUBMITTED]: Object.freeze({
    [WORKFLOW_ACTIONS.START_REVIEW]: BUDGET_STATES.UNDER_REVIEW,
    [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: BUDGET_STATES.DRAFT,
    [WORKFLOW_ACTIONS.REJECT]: BUDGET_STATES.DRAFT
  }),
  [BUDGET_STATES.UNDER_REVIEW]: Object.freeze({
    [WORKFLOW_ACTIONS.APPROVE]: BUDGET_STATES.APPROVED,
    [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: BUDGET_STATES.DRAFT
  }),
  [BUDGET_STATES.APPROVED]: Object.freeze({
    [WORKFLOW_ACTIONS.LOCK]: BUDGET_STATES.LOCKED
  }),
  [BUDGET_STATES.LOCKED]: Object.freeze({})
});

const REMARKS_REQUIRED_ACTIONS = new Set([
  WORKFLOW_ACTIONS.RETURN_TO_DRAFT,
  WORKFLOW_ACTIONS.REJECT,
  WORKFLOW_ACTIONS.LOCK
]);

const LE_TRANSITIONS = Object.freeze({
  [LE_STATES.DRAFT]: Object.freeze({
    [WORKFLOW_ACTIONS.SUBMIT]: LE_STATES.SUBMITTED
  }),
  [LE_STATES.SUBMITTED]: Object.freeze({
    [WORKFLOW_ACTIONS.VALIDATE]: LE_STATES.VALIDATED,
    [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: LE_STATES.DRAFT,
    [WORKFLOW_ACTIONS.REJECT]: LE_STATES.DRAFT
  }),
  [LE_STATES.VALIDATED]: Object.freeze({
    [WORKFLOW_ACTIONS.APPROVE]: LE_STATES.APPROVED,
    [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: LE_STATES.DRAFT
  }),
  [LE_STATES.APPROVED]: Object.freeze({})
});

function getTransitionMap(workflowType) {
  if (workflowType === WORKFLOW_TYPES.BUDGET) return BUDGET_TRANSITIONS;
  if (workflowType === WORKFLOW_TYPES.LE) return LE_TRANSITIONS;
  return {};
}

function getNextState(workflowType, currentState, action) {
  const map = getTransitionMap(workflowType);
  return map[currentState] ? map[currentState][action] || "" : "";
}

function validateTransition({ workflowType, currentState, action, remarks, isLocked }) {
  const normalizedAction = String(action || "").trim().toUpperCase();
  if (!normalizedAction) {
    throw workflowError(400, WORKFLOW_ERROR_CODES.INVALID_WORKFLOW_TRANSITION, "Workflow action is required.");
  }

  if (isLocked) {
    throw workflowError(409, WORKFLOW_ERROR_CODES.WORKFLOW_ALREADY_LOCKED, "Workflow is already locked.");
  }

  const nextState = getNextState(workflowType, currentState, normalizedAction);
  if (!nextState) {
    throw workflowError(409, WORKFLOW_ERROR_CODES.INVALID_WORKFLOW_TRANSITION, "This workflow action is not allowed from the current state.");
  }

  if (REMARKS_REQUIRED_ACTIONS.has(normalizedAction) && !String(remarks || "").trim()) {
    throw workflowError(400, WORKFLOW_ERROR_CODES.WORKFLOW_REMARKS_REQUIRED, "Remarks are required for this workflow action.");
  }

  return {
    action: normalizedAction,
    nextState
  };
}

module.exports = {
  BUDGET_TRANSITIONS,
  LE_TRANSITIONS,
  REMARKS_REQUIRED_ACTIONS,
  getNextState,
  validateTransition
};
