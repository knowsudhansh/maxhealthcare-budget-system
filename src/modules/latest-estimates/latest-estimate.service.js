const { withTransaction } = require("../../db/transaction");
const { getPool } = require("../../db/pool");
const { writeAuditEvent } = require("../../audit/audit-service");
const { SYSTEM_ACTOR, ENTITY_TYPES, WORKFLOW_ACTIONS, WORKFLOW_TYPES } = require("../workflow/workflow.constants");
const { createWorkflow, insertHistory, updateWorkflowState } = require("../workflow/workflow.repository");
const { validateTransition } = require("../workflow/workflow.transitions");
const { workflowError, WORKFLOW_ERROR_CODES } = require("../workflow/workflow.errors");
const { calculateVariance, normalizeThresholds, requiresRemarks } = require("./latest-estimate.variance");
const { LE_MATRIX_STATUSES } = require("./latest-estimate.constants");
const { LE_ERROR_CODES, leError } = require("./latest-estimate.errors");
const {
  findBudgetBaseline,
  findCell,
  findMatrixById,
  findSaveBatch,
  getSummary,
  incrementMatrixVersion,
  insertMatrix,
  insertSaveBatch,
  insertVarianceLog,
  listCells,
  listMatrices,
  updateMatrixWorkflow,
  upsertCell
} = require("./latest-estimate.repository");

function actorFromRequest(req) {
  return Object.assign({}, SYSTEM_ACTOR, { displayName: "system" });
}

function getThresholds(config = {}) {
  return normalizeThresholds({
    warningPercent: config.warningPercent ?? process.env.LE_VARIANCE_WARNING_PERCENT,
    materialPercent: config.materialPercent ?? process.env.LE_VARIANCE_MATERIAL_PERCENT,
    warningAmount: config.warningAmount ?? process.env.LE_VARIANCE_WARNING_AMOUNT,
    materialAmount: config.materialAmount ?? process.env.LE_VARIANCE_MATERIAL_AMOUNT
  });
}

function isDraftMatrix(matrix) {
  return matrix && String(matrix.status || "").toUpperCase() === LE_MATRIX_STATUSES.DRAFT;
}

function ensureEditable(matrix) {
  if (!isDraftMatrix(matrix)) {
    throw leError(409, LE_ERROR_CODES.LE_MATRIX_NOT_EDITABLE, "Latest Estimate matrix is not editable in the current state.", {
      matrixId: matrix && matrix.id,
      status: matrix && matrix.status
    });
  }
}

async function createLatestEstimateMatrix(input, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const matrix = await insertMatrix(connection, input, actor);
    const workflow = await createWorkflow(
      connection,
      {
        workflowType: WORKFLOW_TYPES.LE,
        entityType: ENTITY_TYPES.LE_MATRIX,
        entityId: String(matrix.id),
        budgetCycleId: input.budgetCycleId || 0,
        initialState: LE_MATRIX_STATUSES.DRAFT
      },
      actor
    );
    await insertHistory(
      connection,
      {
        workflowInstanceId: workflow.id,
        fromState: null,
        toState: workflow.currentState,
        action: WORKFLOW_ACTIONS.CREATE,
        remarks: "Latest Estimate workflow created.",
        metadata: { matrixId: matrix.id, financialYear: matrix.financialYear },
        requestId: context.requestId || "",
        idempotencyKey: input.idempotencyKey || ""
      },
      actor
    );
    const linked = await updateMatrixWorkflow(connection, matrix.id, workflow.id);
    await writeAuditEvent(
      connection,
      {
        entityType: "latest_estimate_matrices",
        entityId: matrix.id,
        action: "CREATE",
        newData: { matrixId: matrix.id, financialYear: matrix.financialYear },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return { matrix: linked, workflow };
  }, { requestId: context.requestId || "" });
}

async function getLatestEstimateMatrix(id) {
  const matrix = await findMatrixById(getPool(), id);
  if (!matrix) throw leError(404, LE_ERROR_CODES.LE_MATRIX_NOT_FOUND, "Latest Estimate matrix not found.");
  return matrix;
}

async function listLatestEstimateMatrices(filters) {
  return listMatrices(getPool(), filters);
}

async function getLatestEstimateCells(matrixId, filters) {
  const matrix = await getLatestEstimateMatrix(matrixId);
  const result = await listCells(getPool(), matrix, filters);
  return Object.assign({ matrix }, result);
}

async function bulkSaveCells(matrixId, input, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  const thresholds = getThresholds(context.thresholds || {});
  return withTransaction(async (connection) => {
    const matrix = await findMatrixById(connection, matrixId);
    if (!matrix) throw leError(404, LE_ERROR_CODES.LE_MATRIX_NOT_FOUND, "Latest Estimate matrix not found.");
    ensureEditable(matrix);

    const duplicate = await findSaveBatch(connection, matrix.id, input.idempotencyKey);
    if (duplicate) {
      return {
        matrix,
        savedCellCount: Number(duplicate.saved_cell_count || 0),
        idempotent: true
      };
    }

    if (Number(input.expectedMatrixVersion) !== Number(matrix.versionNumber)) {
      throw leError(409, LE_ERROR_CODES.LE_MATRIX_VERSION_CONFLICT, "Latest Estimate matrix version conflict.", {
        matrixId: matrix.id,
        currentVersion: matrix.versionNumber
      });
    }

    const saved = [];
    for (const cell of input.cells) {
      const baseline = await findBudgetBaseline(connection, matrix, cell);
      if (!baseline) {
        throw leError(422, LE_ERROR_CODES.LE_INVALID_CELL_REFERENCE, "LE cell does not match a budget baseline.", {
          coding: cell.coding,
          location: cell.location
        });
      }
      const existingCell = await findCell(connection, matrix.id, cell);
      if (existingCell && cell.expectedCellVersion && Number(existingCell.cellVersion) !== Number(cell.expectedCellVersion)) {
        throw leError(409, LE_ERROR_CODES.LE_CELL_VERSION_CONFLICT, "Latest Estimate cell version conflict.", {
          coding: cell.coding,
          location: cell.location,
          currentVersion: existingCell.cellVersion
        });
      }

      const variance = calculateVariance(
        {
          budgetAmount: baseline.loc_fy_current,
          latestEstimateAmount: cell.latestEstimateAmount
        },
        thresholds
      );
      if (requiresRemarks(variance) && !String(cell.remarks || "").trim()) {
        throw leError(400, LE_ERROR_CODES.LE_VARIANCE_REMARKS_REQUIRED, "Remarks are required for this material LE variance.", {
          coding: cell.coding,
          location: cell.location,
          budgetAmount: variance.budgetAmount,
          latestEstimateAmount: variance.latestEstimateAmount,
          varianceAmount: variance.varianceAmount,
          severity: variance.varianceSeverity
        });
      }

      const persisted = await upsertCell(
        connection,
        Object.assign({}, cell, {
          matrixId: matrix.id,
          budgetAmount: variance.budgetAmount,
          latestEstimateAmount: variance.latestEstimateAmount,
          varianceAmount: variance.varianceAmount,
          variancePercentage: variance.variancePercentage,
          varianceSeverity: variance.varianceSeverity
        }),
        actor
      );
      saved.push(persisted);
      if (requiresRemarks(variance)) {
        await insertVarianceLog(connection, {
          matrixId: matrix.id,
          cellId: persisted && persisted.id,
          budgetAmount: variance.budgetAmount,
          latestEstimateAmount: variance.latestEstimateAmount,
          varianceAmount: variance.varianceAmount,
          variancePercentage: variance.variancePercentage,
          previousSeverity: existingCell && existingCell.varianceSeverity,
          currentSeverity: variance.varianceSeverity,
          thresholdRule: variance.thresholdRule,
          remarks: cell.remarks,
          metadata: { budgetEntityId: cell.budgetEntityId, requestId: context.requestId || "" }
        });
      }
    }

    const affected = await incrementMatrixVersion(connection, matrix.id, matrix.versionNumber, matrix.status, actor);
    if (!affected) {
      throw leError(409, LE_ERROR_CODES.LE_MATRIX_VERSION_CONFLICT, "Latest Estimate matrix version conflict.", {
        matrixId: matrix.id,
        currentVersion: matrix.versionNumber
      });
    }
    await insertSaveBatch(connection, {
      matrixId: matrix.id,
      idempotencyKey: input.idempotencyKey,
      expectedMatrixVersion: input.expectedMatrixVersion,
      savedCellCount: saved.length,
      requestId: context.requestId || ""
    });
    await writeAuditEvent(
      connection,
      {
        entityType: "latest_estimate_matrices",
        entityId: matrix.id,
        action: "BULK_SAVE",
        newData: { changedCellCount: saved.length, versionBefore: matrix.versionNumber, versionAfter: matrix.versionNumber + 1 },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return {
      matrix: Object.assign({}, matrix, { versionNumber: matrix.versionNumber + 1 }),
      savedCellCount: saved.length,
      cells: saved,
      idempotent: false
    };
  }, { requestId: context.requestId || "" });
}

async function transitionLatestEstimateWorkflow(matrixId, payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const matrix = await findMatrixById(connection, matrixId);
    if (!matrix) throw leError(404, LE_ERROR_CODES.LE_MATRIX_NOT_FOUND, "Latest Estimate matrix not found.");
    const workflow = matrix.workflowInstanceId
      ? await require("../workflow/workflow.repository").findWorkflowById(connection, matrix.workflowInstanceId)
      : null;
    if (!workflow) throw workflowError(404, WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND, "Workflow not found.");

    if (payload.action === WORKFLOW_ACTIONS.VALIDATE) {
      const summary = await getSummary(connection, matrix.id);
      if (summary.missingRemarks > 0 || summary.invalidCells > 0) {
        throw leError(422, LE_ERROR_CODES.LE_VARIANCE_REMARKS_REQUIRED, "Resolve LE validation warnings before validation.", summary);
      }
    }

    if (payload.expectedVersion !== null && Number(payload.expectedVersion) !== Number(workflow.versionNumber)) {
      throw workflowError(409, WORKFLOW_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow version conflict. Refresh and retry.");
    }
    const transition = validateTransition({
      workflowType: workflow.workflowType,
      currentState: workflow.currentState,
      action: payload.action,
      remarks: payload.remarks,
      isLocked: false
    });
    const affected = await updateWorkflowState(connection, {
      id: workflow.id,
      expectedVersion: workflow.versionNumber,
      nextState: transition.nextState,
      isLocked: transition.nextState === LE_MATRIX_STATUSES.APPROVED,
      actor
    });
    if (!affected) throw workflowError(409, WORKFLOW_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow version conflict. Refresh and retry.");
    await insertHistory(
      connection,
      {
        workflowInstanceId: workflow.id,
        fromState: workflow.currentState,
        toState: transition.nextState,
        action: transition.action,
        remarks: payload.remarks,
        metadata: { matrixId: matrix.id },
        requestId: context.requestId || "",
        idempotencyKey: payload.idempotencyKey || ""
      },
      actor
    );
    await connection.execute("UPDATE latest_estimate_matrices SET status = ?, updated_at = NOW() WHERE id = ?", [transition.nextState, matrix.id]);
    await writeAuditEvent(
      connection,
      {
        entityType: "latest_estimate_matrices",
        entityId: matrix.id,
        action: `TRANSITION_${transition.action}`,
        oldData: { status: workflow.currentState },
        newData: { status: transition.nextState },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return {
      matrixId: matrix.id,
      workflowId: workflow.id,
      previousState: workflow.currentState,
      currentState: transition.nextState,
      version: workflow.versionNumber + 1
    };
  }, { requestId: context.requestId || "" });
}

async function getLatestEstimateSummary(matrixId) {
  await getLatestEstimateMatrix(matrixId);
  return getSummary(getPool(), matrixId);
}

module.exports = {
  actorFromRequest,
  bulkSaveCells,
  createLatestEstimateMatrix,
  getLatestEstimateCells,
  getLatestEstimateMatrix,
  getLatestEstimateSummary,
  getThresholds,
  listLatestEstimateMatrices,
  transitionLatestEstimateWorkflow
};
