const { withTransaction } = require("../../db/transaction");
const { getPool } = require("../../db/pool");
const { writeAuditEvent } = require("../../audit/audit-service");
const { sanitizeAuditData } = require("../../audit/audit-service");
const { parsePositiveInteger } = require("../../validation/common");
const {
  BUDGET_STATES,
  DEFAULT_WORKFLOW_STATUS,
  ENTITY_TYPES,
  NOTIFICATION_EVENTS,
  SYSTEM_ACTOR,
  WORKFLOW_ACTIONS,
  WORKFLOW_PERMISSIONS,
  WORKFLOW_TYPES
} = require("./workflow.constants");
const { WORKFLOW_ERROR_CODES, workflowError } = require("./workflow.errors");
const {
  createBudgetCycle,
  createWorkflow,
  findLatestHistoryByWorkflowIds,
  findHistoryByIdempotencyKey,
  findWorkflowByEntity,
  findWorkflowById,
  findWorkflowsByEntities,
  getWorkflowSummary,
  insertHistory,
  listApprovalQueue,
  listBudgetCycles,
  listHistory,
  updateWorkflowState
} = require("./workflow.repository");
const { getNextState } = require("./workflow.transitions");
const { validateTransition } = require("./workflow.transitions");

const EDIT_RESTRICTED_STATES = new Set([
  BUDGET_STATES.SUBMITTED,
  BUDGET_STATES.UNDER_REVIEW,
  BUDGET_STATES.APPROVED,
  BUDGET_STATES.LOCKED
]);

const ACTION_META = Object.freeze({
  [WORKFLOW_ACTIONS.SUBMIT]: { label: "Submit for Review", permission: WORKFLOW_PERMISSIONS.SUBMIT, warning: "Submit this budget record for review." },
  [WORKFLOW_ACTIONS.START_REVIEW]: { label: "Start Review", permission: WORKFLOW_PERMISSIONS.START_REVIEW, warning: "Move this record into review." },
  [WORKFLOW_ACTIONS.APPROVE]: { label: "Approve", permission: WORKFLOW_PERMISSIONS.APPROVE, warning: "Approve this reviewed budget record." },
  [WORKFLOW_ACTIONS.LOCK]: { label: "Lock", permission: WORKFLOW_PERMISSIONS.LOCK, warning: "Lock this budget workflow. Remarks are required." },
  [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: { label: "Return to Draft", permission: WORKFLOW_PERMISSIONS.RETURN_TO_DRAFT, warning: "Return this record to Draft. Remarks are required." },
  [WORKFLOW_ACTIONS.REJECT]: { label: "Reject", permission: WORKFLOW_PERMISSIONS.REJECT, warning: "Reject this workflow back to Draft. Remarks are required." }
});

const ACTION_NOTIFICATION_EVENTS = Object.freeze({
  [WORKFLOW_ACTIONS.SUBMIT]: NOTIFICATION_EVENTS.BUDGET_SUBMITTED,
  [WORKFLOW_ACTIONS.START_REVIEW]: NOTIFICATION_EVENTS.BUDGET_REVIEW_STARTED,
  [WORKFLOW_ACTIONS.APPROVE]: NOTIFICATION_EVENTS.BUDGET_APPROVED,
  [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: NOTIFICATION_EVENTS.BUDGET_RETURNED_TO_DRAFT,
  [WORKFLOW_ACTIONS.REJECT]: NOTIFICATION_EVENTS.BUDGET_REJECTED,
  [WORKFLOW_ACTIONS.LOCK]: NOTIFICATION_EVENTS.BUDGET_LOCKED
});

function actorFromRequest(req) {
  return Object.assign({}, SYSTEM_ACTOR, {
    displayName: "system"
  });
}

function workflowStatusForRow(workflow) {
  if (!workflow) return Object.assign({}, DEFAULT_WORKFLOW_STATUS);
  return {
    workflowId: workflow.id,
    currentState: workflow.currentState,
    versionNumber: workflow.versionNumber,
    isLocked: Boolean(workflow.isLocked),
    label: workflow.currentState
  };
}

function actionRequiresRemarks(action) {
  return [WORKFLOW_ACTIONS.RETURN_TO_DRAFT, WORKFLOW_ACTIONS.REJECT, WORKFLOW_ACTIONS.LOCK].includes(action);
}

function availableActionsForWorkflow(workflow) {
  if (!workflow) {
    return [
      {
        action: "START_WORKFLOW",
        label: "Start Workflow",
        nextState: BUDGET_STATES.DRAFT,
        permission: WORKFLOW_PERMISSIONS.START,
        remarksRequired: false,
        warning: "Create a Draft workflow for this legacy record."
      }
    ];
  }
  const actions = Object.keys(ACTION_META)
    .map((action) => {
      const nextState = getNextState(workflow.workflowType, workflow.currentState, action);
      if (!nextState) return null;
      return Object.assign({}, ACTION_META[action], {
        action,
        nextState,
        remarksRequired: actionRequiresRemarks(action)
      });
    })
    .filter(Boolean);
  return workflow.isLocked ? [] : actions;
}

function notificationForAction(action, workflow) {
  const eventType = ACTION_NOTIFICATION_EVENTS[action];
  if (!eventType) return null;
  return {
    eventType,
    entityType: workflow.entityType,
    entityId: workflow.entityId,
    workflowId: workflow.id
  };
}

function normalizeMetadata(value) {
  return sanitizeAuditData(value && typeof value === "object" && !Array.isArray(value) ? value : {});
}

async function createWorkflowInstance(input, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const existing = await findWorkflowByEntity(connection, input);
    if (existing) return { workflow: existing, created: false };

    const workflow = await createWorkflow(connection, input, actor);
    await insertHistory(
      connection,
      {
        workflowInstanceId: workflow.id,
        fromState: null,
        toState: workflow.currentState,
        action: WORKFLOW_ACTIONS.CREATE,
        remarks: "Workflow instance created.",
        reasonCode: "",
        metadata: { entityType: workflow.entityType, entityId: workflow.entityId },
        idempotencyKey: input.idempotencyKey || "",
        requestId: context.requestId || ""
      },
      actor
    );

    await writeAuditEvent(
      connection,
      {
        entityType: "workflow_instances",
        entityId: workflow.id,
        action: "CREATE",
        newData: workflow,
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );

    return { workflow, created: true };
  }, { requestId: context.requestId || "" });
}

async function getWorkflowById(id) {
  const pool = getPool();
  return findWorkflowById(pool, parsePositiveInteger(id, "workflowId"));
}

async function getWorkflowForEntity(input) {
  const pool = getPool();
  return findWorkflowByEntity(pool, input);
}

async function getWorkflowHistory(workflowId) {
  const pool = getPool();
  const id = parsePositiveInteger(workflowId, "workflowId");
  const workflow = await findWorkflowById(pool, id);
  if (!workflow) {
    throw workflowError(404, WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND, "Workflow not found.");
  }
  return listHistory(pool, id);
}

async function transitionWorkflow(workflowId, input, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  const id = parsePositiveInteger(workflowId, "workflowId");

  return withTransaction(async (connection) => {
    const workflow = await findWorkflowById(connection, id);
    if (!workflow) {
      throw workflowError(404, WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND, "Workflow not found.");
    }

    const previousDuplicate = await findHistoryByIdempotencyKey(connection, id, input.idempotencyKey);
    if (previousDuplicate && previousDuplicate.action === input.action) {
      return {
        workflow,
        previousState: previousDuplicate.fromState,
        currentState: previousDuplicate.toState,
        version: workflow.versionNumber,
        idempotent: true
      };
    }

    if (input.expectedVersion !== null && Number(input.expectedVersion) !== workflow.versionNumber) {
      throw workflowError(409, WORKFLOW_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow version conflict. Refresh and retry.");
    }

    const transition = validateTransition({
      workflowType: workflow.workflowType,
      currentState: workflow.currentState,
      action: input.action,
      remarks: input.remarks,
      isLocked: workflow.isLocked
    });

    const nextLocked = transition.nextState === BUDGET_STATES.LOCKED;
    const affectedRows = await updateWorkflowState(connection, {
      id: workflow.id,
      expectedVersion: workflow.versionNumber,
      nextState: transition.nextState,
      isLocked: nextLocked,
      actor
    });
    if (!affectedRows) {
      throw workflowError(409, WORKFLOW_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow version conflict. Refresh and retry.");
    }

    await insertHistory(
      connection,
      {
        workflowInstanceId: workflow.id,
        fromState: workflow.currentState,
        toState: transition.nextState,
        action: transition.action,
        remarks: input.remarks,
        reasonCode: input.reasonCode,
        metadata: normalizeMetadata(input.metadata),
        idempotencyKey: input.idempotencyKey || "",
        requestId: context.requestId || ""
      },
      actor
    );

    await writeAuditEvent(
      connection,
      {
        entityType: "workflow_instances",
        entityId: workflow.id,
        action: `TRANSITION_${transition.action}`,
        oldData: {
          currentState: workflow.currentState,
          versionNumber: workflow.versionNumber
        },
        newData: {
          currentState: transition.nextState,
          versionNumber: workflow.versionNumber + 1,
          remarks: input.remarks
        },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );

    return {
      workflow: Object.assign({}, workflow, {
        currentState: transition.nextState,
        versionNumber: workflow.versionNumber + 1,
        isLocked: nextLocked
      }),
      previousState: workflow.currentState,
      currentState: transition.nextState,
      version: workflow.versionNumber + 1,
      notificationEvent: notificationForAction(transition.action, workflow),
      idempotent: false
    };
  }, { requestId: context.requestId || "" });
}

async function listCycles() {
  const pool = getPool();
  return listBudgetCycles(pool);
}

async function createCycle(input) {
  return withTransaction(async (connection) => createBudgetCycle(connection, input));
}

async function attachBudgetWorkflowStatuses(rows, options = {}) {
  const records = Array.isArray(rows) ? rows : [];
  if (!records.length) return records;
  if (options.enabled === false) {
    return records;
  }

  try {
    const pool = getPool();
    const ids = records.map((row) => row && row.id).filter(Boolean);
    const workflows = await findWorkflowsByEntities(pool, {
      workflowType: WORKFLOW_TYPES.BUDGET,
      entityType: ENTITY_TYPES.BUDGET_SUBMISSION,
      entityIds: ids
    });
    const byEntity = new Map(workflows.map((workflow) => [String(workflow.entityId), workflow]));
    const latestHistory = await findLatestHistoryByWorkflowIds(pool, workflows.map((workflow) => workflow.id));
    return records.map((row) => {
      const workflow = byEntity.get(String(row.id));
      const status = workflowStatusForRow(workflow);
      const latest = workflow ? latestHistory.get(String(workflow.id)) : null;
      return Object.assign({}, row, {
        workflow_id: status.workflowId || null,
        workflow_status: status.currentState,
        workflow_version: status.versionNumber,
        workflow_is_locked: status.isLocked ? 1 : 0,
        workflow_available_actions: JSON.stringify(availableActionsForWorkflow(workflow)),
        workflow_last_action: latest ? latest.action : null,
        workflow_last_transition_at: latest ? latest.performedAt : null
      });
    });
  } catch (_error) {
    return records.map((row) =>
      Object.assign({}, row, {
        workflow_id: null,
        workflow_status: DEFAULT_WORKFLOW_STATUS.currentState,
        workflow_version: null,
        workflow_is_locked: 0
      })
    );
  }
}

async function assertBudgetRecordMutable(entityId, operation, options = {}) {
  if (!options.enforce) return { allowed: true, state: "NOT_ENFORCED" };
  const pool = getPool();
  const workflow = await findWorkflowByEntity(pool, {
    workflowType: WORKFLOW_TYPES.BUDGET,
    entityType: ENTITY_TYPES.BUDGET_SUBMISSION,
    entityId: String(entityId),
    budgetCycleId: 0
  });
  if (!workflow) return { allowed: true, state: "LEGACY" };
  if (!EDIT_RESTRICTED_STATES.has(workflow.currentState)) return { allowed: true, state: workflow.currentState };
  const isDelete = operation === "delete";
  throw workflowError(
    409,
    isDelete ? "BUDGET_WORKFLOW_DELETE_RESTRICTED" : "BUDGET_WORKFLOW_EDIT_RESTRICTED",
    isDelete ? "Delete is restricted by the budget workflow state." : "Edit is restricted by the budget workflow state.",
    {
      entityId: String(entityId),
      currentState: workflow.currentState,
      permittedAction: "RETURN_TO_DRAFT"
    }
  );
}

function normalizeQueueFilters(input = {}) {
  const page = Math.max(1, Number.parseInt(input.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(input.pageSize || input.page_size || "25", 10) || 25));
  return {
    state: String(input.state || "").trim().toUpperCase(),
    financialYear: String(input.financialYear || input.financial_year || "").trim(),
    location: String(input.location || "").trim(),
    coding: String(input.coding || "").trim(),
    owner: String(input.owner || "").trim(),
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

async function getApprovalQueue(input = {}) {
  const pool = getPool();
  const filters = normalizeQueueFilters(input);
  const result = await listApprovalQueue(pool, filters);
  return {
    rows: result.rows.map((item) => ({
      workflow: Object.assign({}, item.workflow, {
        availableActions: availableActionsForWorkflow(item.workflow)
      }),
      record: item.record
    })),
    total: result.total,
    page: filters.page,
    pageSize: filters.pageSize
  };
}

async function getBudgetWorkflowSummary(input = {}) {
  const pool = getPool();
  return getWorkflowSummary(pool, normalizeQueueFilters(input));
}

module.exports = {
  actorFromRequest,
  attachBudgetWorkflowStatuses,
  assertBudgetRecordMutable,
  availableActionsForWorkflow,
  createCycle,
  createWorkflowInstance,
  getApprovalQueue,
  getBudgetWorkflowSummary,
  getWorkflowById,
  getWorkflowForEntity,
  getWorkflowHistory,
  transitionWorkflow,
  listCycles,
  workflowStatusForRow
};
