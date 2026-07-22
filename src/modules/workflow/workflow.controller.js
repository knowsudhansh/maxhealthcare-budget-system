const { parsePositiveInteger } = require("../../validation/common");
const { ENTITY_TYPES, WORKFLOW_TYPES } = require("./workflow.constants");
const { WORKFLOW_ERROR_CODES, workflowError } = require("./workflow.errors");
const {
  normalizeCyclePayload,
  normalizeTransitionPayload,
  normalizeWorkflowCreatePayload
} = require("./workflow.validation");
const {
  actorFromRequest,
  createCycle,
  createWorkflowInstance,
  getApprovalQueue,
  getBudgetWorkflowSummary,
  getWorkflowById,
  getWorkflowForEntity,
  getWorkflowHistory,
  listCycles,
  transitionWorkflow,
  availableActionsForWorkflow
} = require("./workflow.service");

function sendSuccess(req, res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req.requestId || ""
  });
}

async function createWorkflow(req, res, next) {
  try {
    const payload = normalizeWorkflowCreatePayload(req.body || {});
    const result = await createWorkflowInstance(payload, {
      requestId: req.requestId,
      actor: actorFromRequest(req)
    });
    return sendSuccess(req, res, result, result.created ? 201 : 200);
  } catch (error) {
    return next(error);
  }
}

async function getWorkflow(req, res, next) {
  try {
    const workflow = await getWorkflowById(req.params.workflowId);
    if (!workflow) throw workflowError(404, WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND, "Workflow not found.");
    return sendSuccess(req, res, workflow);
  } catch (error) {
    return next(error);
  }
}

async function getWorkflowActions(req, res, next) {
  try {
    const workflow = await getWorkflowById(req.params.workflowId);
    if (!workflow) throw workflowError(404, WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND, "Workflow not found.");
    return sendSuccess(req, res, availableActionsForWorkflow(workflow));
  } catch (error) {
    return next(error);
  }
}

async function getWorkflowByEntity(req, res, next) {
  try {
    const entityType = String(req.params.entityType || "").trim().toUpperCase();
    const entityId = String(req.params.entityId || "").trim();
    const budgetCycleId = req.query.budgetCycleId ? parsePositiveInteger(req.query.budgetCycleId, "budgetCycleId") : 0;
    const workflowType = String(req.query.workflowType || WORKFLOW_TYPES.BUDGET).trim().toUpperCase();
    if (!Object.values(ENTITY_TYPES).includes(entityType) || !entityId) {
      throw workflowError(400, WORKFLOW_ERROR_CODES.INVALID_WORKFLOW_ENTITY, "Workflow entity is invalid.");
    }
    const workflow = await getWorkflowForEntity({ workflowType, entityType, entityId, budgetCycleId });
    return sendSuccess(req, res, workflow || null);
  } catch (error) {
    return next(error);
  }
}

async function transition(req, res, next) {
  try {
    const payload = normalizeTransitionPayload(req.body || {});
    const result = await transitionWorkflow(req.params.workflowId, payload, {
      requestId: req.requestId,
      actor: actorFromRequest(req)
    });
    return sendSuccess(req, res, {
      workflowId: result.workflow.id,
      previousState: result.previousState,
      currentState: result.currentState,
      version: result.version,
      idempotent: result.idempotent
    });
  } catch (error) {
    return next(error);
  }
}

async function history(req, res, next) {
  try {
    const rows = await getWorkflowHistory(req.params.workflowId);
    return sendSuccess(req, res, rows);
  } catch (error) {
    return next(error);
  }
}

async function listBudgetCycles(req, res, next) {
  try {
    return sendSuccess(req, res, await listCycles());
  } catch (error) {
    return next(error);
  }
}

async function queue(req, res, next) {
  try {
    return sendSuccess(req, res, await getApprovalQueue(req.query || {}));
  } catch (error) {
    return next(error);
  }
}

async function summary(req, res, next) {
  try {
    return sendSuccess(req, res, await getBudgetWorkflowSummary(req.query || {}));
  } catch (error) {
    return next(error);
  }
}

async function createBudgetCycle(req, res, next) {
  try {
    const cycle = await createCycle(normalizeCyclePayload(req.body || {}));
    return sendSuccess(req, res, cycle, 201);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBudgetCycle,
  createWorkflow,
  getWorkflow,
  getWorkflowActions,
  getWorkflowByEntity,
  history,
  listBudgetCycles,
  queue,
  summary,
  transition
};
