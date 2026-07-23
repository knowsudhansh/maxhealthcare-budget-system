const { withTransaction } = require("../../db/transaction");
const { getPool } = require("../../db/pool");
const { writeAuditEvent } = require("../../audit/audit-service");
const { parsePositiveInteger } = require("../../validation/common");
const {
  ENTITY_TYPES,
  NOTIFICATION_EVENTS,
  SYSTEM_ACTOR,
  TRANSFER_STATES,
  WORKFLOW_ACTIONS,
  WORKFLOW_TYPES
} = require("../workflow/workflow.constants");
const {
  createWorkflow,
  findHistoryByIdempotencyKey,
  findWorkflowById,
  insertHistory,
  updateWorkflowState
} = require("../workflow/workflow.repository");
const { validateTransition } = require("../workflow/workflow.transitions");
const {
  buildPostingEntries,
  buildReversalEntries,
  computeWorkingBudget,
  toMoney
} = require("./transfer.ledger");
const {
  TRANSFER_ERROR_CODES,
  transferError
} = require("./transfer.errors");
const repo = require("./transfer.repository");

const EDITABLE_STATUSES = new Set([TRANSFER_STATES.DRAFT]);
const APPROVED_BUDGET_STATES = new Set(["APPROVED", "LOCKED", "LEGACY"]);

function actorFromRequest(req) {
  return Object.assign({}, SYSTEM_ACTOR, {
    displayName: "system"
  });
}

function isFeatureEnabled(config, key, fallback = true) {
  const features = config && config.features ? config.features : {};
  if (Object.prototype.hasOwnProperty.call(features, key)) return Boolean(features[key]);
  return fallback;
}

function actionToStatus(action) {
  if (action === WORKFLOW_ACTIONS.SUBMIT) return TRANSFER_STATES.SUBMITTED;
  if (action === WORKFLOW_ACTIONS.START_REVIEW) return TRANSFER_STATES.UNDER_REVIEW;
  if (action === WORKFLOW_ACTIONS.APPROVE) return TRANSFER_STATES.APPROVED;
  if (action === WORKFLOW_ACTIONS.RETURN_TO_DRAFT) return TRANSFER_STATES.DRAFT;
  if (action === WORKFLOW_ACTIONS.REJECT || action === WORKFLOW_ACTIONS.CANCEL) return TRANSFER_STATES.CANCELLED;
  if (action === WORKFLOW_ACTIONS.POST) return TRANSFER_STATES.POSTED;
  if (action === WORKFLOW_ACTIONS.REVERSE) return TRANSFER_STATES.REVERSED;
  return "";
}

function notificationForAction(action) {
  const map = {
    [WORKFLOW_ACTIONS.SUBMIT]: NOTIFICATION_EVENTS.TRANSFER_SUBMITTED,
    [WORKFLOW_ACTIONS.START_REVIEW]: NOTIFICATION_EVENTS.TRANSFER_REVIEW_STARTED,
    [WORKFLOW_ACTIONS.APPROVE]: NOTIFICATION_EVENTS.TRANSFER_APPROVED,
    [WORKFLOW_ACTIONS.RETURN_TO_DRAFT]: NOTIFICATION_EVENTS.TRANSFER_RETURNED,
    [WORKFLOW_ACTIONS.REJECT]: NOTIFICATION_EVENTS.TRANSFER_REJECTED,
    [WORKFLOW_ACTIONS.POST]: NOTIFICATION_EVENTS.TRANSFER_POSTED,
    [WORKFLOW_ACTIONS.REVERSE]: NOTIFICATION_EVENTS.TRANSFER_REVERSED
  };
  return map[action] || null;
}

async function loadTransferDetails(db, transferId) {
  const request = await repo.findTransferById(db, transferId);
  if (!request) {
    throw transferError(404, TRANSFER_ERROR_CODES.TRANSFER_NOT_FOUND, "Transfer request not found.");
  }
  const [lines, postings, history] = await Promise.all([
    repo.listTransferLines(db, transferId),
    repo.listPostings(db, transferId),
    repo.listTransferHistory(db, transferId)
  ]);
  return { request, lines, postings, history };
}

async function validateLineBudget(db, line, financialYear) {
  const source = await repo.findApprovedBudgetLine(db, line.sourceBudgetLineId);
  const destination = await repo.findApprovedBudgetLine(db, line.destinationBudgetLineId);

  if (!source) {
    throw transferError(422, TRANSFER_ERROR_CODES.TRANSFER_SOURCE_NOT_APPROVED, "Source approved budget line does not exist.");
  }
  if (!destination) {
    throw transferError(422, TRANSFER_ERROR_CODES.TRANSFER_DESTINATION_INVALID, "Destination budget line does not exist.");
  }
  if (!APPROVED_BUDGET_STATES.has(String(source.workflow_state || "").toUpperCase())) {
    throw transferError(422, TRANSFER_ERROR_CODES.TRANSFER_SOURCE_NOT_APPROVED, "Source budget line is not an approved or legacy baseline.");
  }
  if (String(source.financial_year || "") !== String(financialYear || "") || String(destination.financial_year || "") !== String(financialYear || "")) {
    throw transferError(422, TRANSFER_ERROR_CODES.TRANSFER_DESTINATION_INVALID, "Transfer lines must match the transfer financial year.");
  }

  const totals = await repo.getPostingTotals(db, source.id, financialYear);
  const balance = computeWorkingBudget({
    originalBudget: source.loc_fy_current,
    incomingTransfers: totals.incomingTransfers,
    outgoingTransfers: totals.outgoingTransfers
  });
  if (toMoney(line.transferAmount) > balance.availableBalance) {
    throw transferError(422, TRANSFER_ERROR_CODES.TRANSFER_INSUFFICIENT_BALANCE, "Transfer amount exceeds available balance.");
  }

  return { source, destination, balance };
}

function enrichLineFromBudget(line, validation) {
  const source = validation.source || {};
  const destination = validation.destination || {};
  return Object.assign({}, line, {
    sourceCoding: line.sourceCoding || source.coding || "",
    destinationCoding: line.destinationCoding || destination.coding || "",
    sourceDepartment: line.sourceDepartment || source.cost_center_department || "",
    destinationDepartment: line.destinationDepartment || destination.cost_center_department || "",
    sourceLocation: line.sourceLocation || source.location || "",
    destinationLocation: line.destinationLocation || destination.location || "",
    sourceOwner: line.sourceOwner || source.owner || "",
    destinationOwner: line.destinationOwner || destination.owner || "",
    sourceCategory: line.sourceCategory || source.category_it || "",
    destinationCategory: line.destinationCategory || destination.category_it || ""
  });
}

async function createTransfer(payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  const requestId = context.requestId || "";
  return withTransaction(async (connection) => {
    const duplicate = await repo.findTransferByNumber(connection, payload.transferNumber);
    if (duplicate && payload.idempotencyKey) {
      return Object.assign(await loadTransferDetails(connection, duplicate.id), { idempotent: true });
    }
    if (duplicate) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_DUPLICATE_REQUEST, "Transfer number already exists.");
    }

    const validatedLines = [];
    for (const line of payload.lines) {
      const validation = await validateLineBudget(connection, line, payload.financialYear);
      validatedLines.push(enrichLineFromBudget(line, validation));
    }

    let request = await repo.insertTransferRequest(connection, payload, actor);
    for (const line of validatedLines) {
      await repo.insertTransferLine(connection, request.id, line, actor);
    }

    const workflow = await createWorkflow(
      connection,
      {
        workflowType: WORKFLOW_TYPES.TRANSFER,
        entityType: ENTITY_TYPES.TRANSFER,
        entityId: String(request.id),
        budgetCycleId: 0,
        initialState: TRANSFER_STATES.DRAFT
      },
      actor
    );
    await repo.updateTransferWorkflow(connection, request.id, workflow.id);
    await insertHistory(
      connection,
      {
        workflowInstanceId: workflow.id,
        fromState: null,
        toState: workflow.currentState,
        action: WORKFLOW_ACTIONS.CREATE,
        remarks: payload.remarks || "Transfer request created.",
        reasonCode: "",
        metadata: { transferNumber: request.transferNumber, transferType: request.transferType },
        idempotencyKey: payload.idempotencyKey || "",
        requestId
      },
      actor
    );
    await repo.insertTransferHistory(
      connection,
      {
        transferRequestId: request.id,
        fromStatus: null,
        toStatus: TRANSFER_STATES.DRAFT,
        action: WORKFLOW_ACTIONS.CREATE,
        remarks: payload.remarks || "Transfer request created.",
        metadata: { workflowId: workflow.id },
        requestId
      },
      actor
    );
    await writeAuditEvent(
      connection,
      {
        entityType: "budget_transfer_requests",
        entityId: request.id,
        action: "CREATE",
        newData: { request, lines: payload.lines },
        changedBy: actor.displayName,
        requestId
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );

    return Object.assign(await loadTransferDetails(connection, request.id), {
      workflow,
      notificationEvent: NOTIFICATION_EVENTS.TRANSFER_CREATED,
      idempotent: false
    });
  }, { requestId });
}

async function listTransfers(filters) {
  const pool = getPool();
  return repo.listTransfers(pool, filters);
}

async function getTransfer(id) {
  const pool = getPool();
  return loadTransferDetails(pool, parsePositiveInteger(id, "transferId"));
}

async function transitionTransfer(id, action, payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  const requestId = context.requestId || "";
  const transferId = parsePositiveInteger(id, "transferId");
  return withTransaction(async (connection) => {
    const request = await repo.findTransferById(connection, transferId);
    if (!request) throw transferError(404, TRANSFER_ERROR_CODES.TRANSFER_NOT_FOUND, "Transfer request not found.");
    const workflow = request.workflowInstanceId ? await findWorkflowById(connection, request.workflowInstanceId) : null;
    if (!workflow) throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_NOT_EDITABLE, "Transfer workflow is not available.");

    const duplicate = await findHistoryByIdempotencyKey(connection, workflow.id, payload.idempotencyKey);
    if (duplicate && duplicate.action === action) {
      return Object.assign(await loadTransferDetails(connection, transferId), { idempotent: true });
    }
    if (Number(payload.expectedVersion) !== request.versionNumber || Number(payload.expectedVersion) !== workflow.versionNumber) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_VERSION_CONFLICT, "Transfer version conflict. Refresh and retry.");
    }

    const transition = validateTransition({
      workflowType: WORKFLOW_TYPES.TRANSFER,
      currentState: workflow.currentState,
      action,
      remarks: payload.remarks,
      isLocked: false
    });

    const affectedWorkflow = await updateWorkflowState(connection, {
      id: workflow.id,
      expectedVersion: workflow.versionNumber,
      nextState: transition.nextState,
      isLocked: false,
      actor
    });
    const nextStatus = actionToStatus(action);
    const affectedTransfer = await repo.updateTransferStatus(connection, transferId, request.versionNumber, nextStatus, actor);
    if (!affectedWorkflow || !affectedTransfer) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_VERSION_CONFLICT, "Transfer version conflict. Refresh and retry.");
    }

    await insertHistory(
      connection,
      {
        workflowInstanceId: workflow.id,
        fromState: workflow.currentState,
        toState: transition.nextState,
        action: transition.action,
        remarks: payload.remarks,
        reasonCode: "",
        metadata: { transferRequestId: transferId },
        idempotencyKey: payload.idempotencyKey || "",
        requestId
      },
      actor
    );
    await repo.insertTransferHistory(
      connection,
      {
        transferRequestId: transferId,
        fromStatus: request.status,
        toStatus: nextStatus,
        action: transition.action,
        remarks: payload.remarks,
        metadata: { workflowId: workflow.id },
        requestId
      },
      actor
    );
    await writeAuditEvent(
      connection,
      {
        entityType: "budget_transfer_requests",
        entityId: transferId,
        action: `TRANSFER_${transition.action}`,
        oldData: { status: request.status, versionNumber: request.versionNumber },
        newData: { status: nextStatus, versionNumber: request.versionNumber + 1 },
        changedBy: actor.displayName,
        requestId
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );

    return Object.assign(await loadTransferDetails(connection, transferId), {
      previousState: workflow.currentState,
      currentState: transition.nextState,
      version: request.versionNumber + 1,
      notificationEvent: notificationForAction(action),
      idempotent: false
    });
  }, { requestId });
}

async function updateWorkingBalanceForLine(connection, budgetLineId, financialYear, transferId) {
  const line = await repo.findApprovedBudgetLine(connection, budgetLineId);
  if (!line) return null;
  const totals = await repo.getPostingTotals(connection, budgetLineId, financialYear);
  const balance = Object.assign(
    {
      budgetLineId,
      financialYear
    },
    computeWorkingBudget({
      originalBudget: line.loc_fy_current,
      incomingTransfers: totals.incomingTransfers,
      outgoingTransfers: totals.outgoingTransfers
    })
  );
  await repo.upsertWorkingBalance(connection, balance, transferId);
  return balance;
}

async function postTransfer(id, payload, context = {}) {
  const config = context.config || {};
  if (!isFeatureEnabled(config, "transferPostingEnabled", process.env.TRANSFER_POSTING_ENABLED !== "false")) {
    throw transferError(403, TRANSFER_ERROR_CODES.TRANSFER_POSTING_DISABLED, "Transfer posting is disabled.");
  }
  const actor = context.actor || SYSTEM_ACTOR;
  const requestId = context.requestId || "";
  const transferId = parsePositiveInteger(id, "transferId");
  return withTransaction(async (connection) => {
    const request = await repo.findTransferById(connection, transferId);
    if (!request) throw transferError(404, TRANSFER_ERROR_CODES.TRANSFER_NOT_FOUND, "Transfer request not found.");
    if (request.status !== TRANSFER_STATES.APPROVED) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_NOT_APPROVED, "Only approved transfers can be posted.");
    }
    if (Number(payload.expectedVersion) !== request.versionNumber) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_VERSION_CONFLICT, "Transfer version conflict. Refresh and retry.");
    }
    const workflow = request.workflowInstanceId ? await findWorkflowById(connection, request.workflowInstanceId) : null;
    if (!workflow) throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_NOT_EDITABLE, "Transfer workflow is not available.");
    const duplicate = await findHistoryByIdempotencyKey(connection, workflow.id, payload.idempotencyKey);
    if (duplicate && duplicate.action === WORKFLOW_ACTIONS.POST) {
      return Object.assign(await loadTransferDetails(connection, transferId), { idempotent: true });
    }
    const transition = validateTransition({
      workflowType: WORKFLOW_TYPES.TRANSFER,
      currentState: workflow.currentState,
      action: WORKFLOW_ACTIONS.POST,
      remarks: payload.remarks,
      isLocked: false
    });
    const existingPostings = await repo.listPostings(connection, transferId);
    if (existingPostings.some((posting) => posting.postingStatus === "POSTED")) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_ALREADY_POSTED, "Transfer has already been posted.");
    }

    const lines = await repo.listTransferLines(connection, transferId);
    for (const line of lines) {
      await validateLineBudget(connection, line, request.financialYear);
    }
    for (const line of lines) {
      const postings = buildPostingEntries(line, request);
      for (const posting of postings) {
        await repo.insertPosting(connection, posting, actor, requestId);
      }
      await updateWorkingBalanceForLine(connection, line.sourceBudgetLineId, request.financialYear, transferId);
      await updateWorkingBalanceForLine(connection, line.destinationBudgetLineId, request.financialYear, transferId);
    }
    const affectedWorkflow = await updateWorkflowState(connection, {
      id: workflow.id,
      expectedVersion: workflow.versionNumber,
      nextState: transition.nextState,
      isLocked: false,
      actor
    });
    if (!affectedWorkflow) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_VERSION_CONFLICT, "Transfer version conflict. Refresh and retry.");
    }
    await repo.updateTransferStatus(connection, transferId, request.versionNumber, TRANSFER_STATES.POSTED, actor, { postedAt: true });
    await insertHistory(connection, {
      workflowInstanceId: workflow.id,
      fromState: workflow.currentState,
      toState: transition.nextState,
      action: WORKFLOW_ACTIONS.POST,
      remarks: payload.remarks,
      reasonCode: "",
      metadata: { transferRequestId: transferId },
      idempotencyKey: payload.idempotencyKey || "",
      requestId
    }, actor);
    await repo.insertTransferHistory(connection, {
      transferRequestId: transferId,
      fromStatus: request.status,
      toStatus: TRANSFER_STATES.POSTED,
      action: WORKFLOW_ACTIONS.POST,
      remarks: payload.remarks,
      metadata: { postingCount: lines.length * 2 },
      requestId
    }, actor);
    await writeAuditEvent(connection, {
      entityType: "budget_transfer_requests",
      entityId: transferId,
      action: "TRANSFER_POST",
      oldData: { status: request.status },
      newData: { status: TRANSFER_STATES.POSTED },
      changedBy: actor.displayName,
      requestId
    }, { enabled: process.env.ENABLE_AUDIT_LOGS === "true" });
    return Object.assign(await loadTransferDetails(connection, transferId), { notificationEvent: NOTIFICATION_EVENTS.TRANSFER_POSTED });
  }, { requestId });
}

async function reverseTransfer(id, payload, context = {}) {
  const config = context.config || {};
  if (!isFeatureEnabled(config, "transferReversalEnabled", process.env.TRANSFER_REVERSAL_ENABLED !== "false")) {
    throw transferError(403, TRANSFER_ERROR_CODES.TRANSFER_REVERSAL_DISABLED, "Transfer reversal is disabled.");
  }
  const actor = context.actor || SYSTEM_ACTOR;
  const requestId = context.requestId || "";
  const transferId = parsePositiveInteger(id, "transferId");
  return withTransaction(async (connection) => {
    const request = await repo.findTransferById(connection, transferId);
    if (!request) throw transferError(404, TRANSFER_ERROR_CODES.TRANSFER_NOT_FOUND, "Transfer request not found.");
    if (request.status !== TRANSFER_STATES.POSTED) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_NOT_POSTED, "Only posted transfers can be reversed.");
    }
    if (Number(payload.expectedVersion) !== request.versionNumber) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_VERSION_CONFLICT, "Transfer version conflict. Refresh and retry.");
    }
    const workflow = request.workflowInstanceId ? await findWorkflowById(connection, request.workflowInstanceId) : null;
    if (!workflow) throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_NOT_EDITABLE, "Transfer workflow is not available.");
    const duplicate = await findHistoryByIdempotencyKey(connection, workflow.id, payload.idempotencyKey);
    if (duplicate && duplicate.action === WORKFLOW_ACTIONS.REVERSE) {
      return Object.assign(await loadTransferDetails(connection, transferId), { idempotent: true });
    }
    const transition = validateTransition({
      workflowType: WORKFLOW_TYPES.TRANSFER,
      currentState: workflow.currentState,
      action: WORKFLOW_ACTIONS.REVERSE,
      remarks: payload.remarks,
      isLocked: false
    });
    const postings = await repo.listPostings(connection, transferId);
    const originalPostings = postings.filter((posting) => !posting.reversalOfPostingId && (posting.postingType === "DEBIT_SOURCE" || posting.postingType === "CREDIT_DESTINATION"));
    const existingReversals = postings.filter((posting) => posting.reversalOfPostingId);
    if (existingReversals.length) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_ALREADY_POSTED, "Transfer reversal already exists.");
    }
    for (const posting of originalPostings) {
      await repo.insertPosting(connection, buildReversalEntries(posting), actor, requestId);
      await updateWorkingBalanceForLine(connection, posting.budgetLineId, request.financialYear, transferId);
    }
    const affectedWorkflow = await updateWorkflowState(connection, {
      id: workflow.id,
      expectedVersion: workflow.versionNumber,
      nextState: transition.nextState,
      isLocked: false,
      actor
    });
    if (!affectedWorkflow) {
      throw transferError(409, TRANSFER_ERROR_CODES.TRANSFER_VERSION_CONFLICT, "Transfer version conflict. Refresh and retry.");
    }
    await repo.updateTransferStatus(connection, transferId, request.versionNumber, TRANSFER_STATES.REVERSED, actor, { reversedAt: true });
    await insertHistory(connection, {
      workflowInstanceId: workflow.id,
      fromState: workflow.currentState,
      toState: transition.nextState,
      action: WORKFLOW_ACTIONS.REVERSE,
      remarks: payload.remarks,
      reasonCode: "",
      metadata: { transferRequestId: transferId },
      idempotencyKey: payload.idempotencyKey || "",
      requestId
    }, actor);
    await repo.insertTransferHistory(connection, {
      transferRequestId: transferId,
      fromStatus: request.status,
      toStatus: TRANSFER_STATES.REVERSED,
      action: WORKFLOW_ACTIONS.REVERSE,
      remarks: payload.remarks,
      metadata: { reversalCount: originalPostings.length },
      requestId
    }, actor);
    await writeAuditEvent(connection, {
      entityType: "budget_transfer_requests",
      entityId: transferId,
      action: "TRANSFER_REVERSE",
      oldData: { status: request.status },
      newData: { status: TRANSFER_STATES.REVERSED },
      changedBy: actor.displayName,
      requestId
    }, { enabled: process.env.ENABLE_AUDIT_LOGS === "true" });
    return Object.assign(await loadTransferDetails(connection, transferId), { notificationEvent: NOTIFICATION_EVENTS.TRANSFER_REVERSED });
  }, { requestId });
}

async function getTransferHistory(id) {
  const pool = getPool();
  const transferId = parsePositiveInteger(id, "transferId");
  const transfer = await repo.findTransferById(pool, transferId);
  if (!transfer) throw transferError(404, TRANSFER_ERROR_CODES.TRANSFER_NOT_FOUND, "Transfer request not found.");
  return repo.listTransferHistory(pool, transferId);
}

async function getTransferDashboard() {
  const pool = getPool();
  return repo.getDashboard(pool);
}

async function getWorkingBudget(filters) {
  const pool = getPool();
  return repo.listWorkingBudget(pool, filters);
}

module.exports = {
  actorFromRequest,
  createTransfer,
  getTransfer,
  getTransferDashboard,
  getTransferHistory,
  getWorkingBudget,
  listTransfers,
  postTransfer,
  reverseTransfer,
  transitionTransfer,
  validateLineBudget
};
