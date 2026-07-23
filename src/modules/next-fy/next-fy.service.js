const { withTransaction } = require("../../db/transaction");
const { getPool } = require("../../db/pool");
const { writeAuditEvent } = require("../../audit/audit-service");
const { ENTITY_TYPES, NEXT_FY_STATES, SYSTEM_ACTOR, WORKFLOW_ACTIONS, WORKFLOW_TYPES } = require("../workflow/workflow.constants");
const { createWorkflow, findHistoryByIdempotencyKey, findWorkflowById, insertHistory, updateWorkflowState } = require("../workflow/workflow.repository");
const { validateTransition } = require("../workflow/workflow.transitions");
const { WORKFLOW_ERROR_CODES, workflowError } = require("../workflow/workflow.errors");
const { chooseAssumptionRule, assertNoAmbiguousRules } = require("./next-fy.assumptions");
const { NEXT_FY_SOURCE_STRATEGIES, NEXT_FY_STATUSES, VALIDATION_STATUS } = require("./next-fy.constants");
const { calculateNextFyLine } = require("./next-fy.generator");
const { NEXT_FY_ERROR_CODES, nextFyError } = require("./next-fy.errors");
const {
  findBudgetById,
  findGenerationBatch,
  findLineById,
  getSummary,
  incrementBudgetVersionAndTotals,
  insertAdjustmentHistory,
  insertBudget,
  insertGenerationBatch,
  insertOrUpdateRule,
  listBudgets,
  listLines,
  listRules,
  loadApprovedLeSourceLines,
  loadEligibleBudgetSourceLines,
  replaceGeneratedLines,
  updateBudgetWorkflow,
  updateLineAdjustment
} = require("./next-fy.repository");

function actorFromRequest() {
  return Object.assign({}, SYSTEM_ACTOR, { displayName: "system" });
}

function featureConfig(config = {}) {
  const features = config.features || {};
  return {
    allowLegacySource: Boolean(features.nextFyAllowLegacySource),
    allowManualBaseline: Boolean(features.nextFyAllowManualBaseline),
    allowGenerationReset: Boolean(features.nextFyAllowGenerationReset),
    maxBulkLines: Number(features.nextFyMaxBulkLines || process.env.NEXT_FY_MAX_BULK_LINES || 500)
  };
}

function ensureEditable(budget) {
  const state = String(budget && budget.status || "").toUpperCase();
  if (state === NEXT_FY_STATUSES.UNDER_REVIEW) {
    throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_UNDER_REVIEW, "Next FY budget is under review and is read-only.");
  }
  if (state === NEXT_FY_STATUSES.APPROVED) {
    throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_ALREADY_APPROVED, "Approved Next FY budget is read-only.");
  }
  if (state === NEXT_FY_STATUSES.LOCKED) {
    throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_LOCKED, "Locked Next FY budget is read-only.");
  }
  if (state !== NEXT_FY_STATUSES.GENERATED) {
    throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_EDITABLE, "Next FY budget is not editable in the current state.");
  }
}

function normalizeSourceLine(line, targetFinancialYear) {
  return {
    sourceType: line.sourceType,
    sourceEntityId: line.sourceEntityId,
    sourceLineId: line.sourceLineId,
    sourceVersion: line.sourceVersion || 1,
    sourceFinancialYear: line.sourceFinancialYear,
    targetFinancialYear,
    coding: line.coding || "",
    item: line.item || "",
    description: line.description || "",
    category: line.category || "",
    location: line.location || "",
    owner: line.owner || "",
    owner1: line.owner1 || "",
    sourceAmount: Number(line.sourceAmount || 0)
  };
}

async function loadSourceLines(connection, budget, config = {}) {
  if (budget.sourceStrategy === NEXT_FY_SOURCE_STRATEGIES.MANUAL_BASELINE && !featureConfig(config).allowManualBaseline) {
    throw nextFyError(403, NEXT_FY_ERROR_CODES.NEXT_FY_MANUAL_BASELINE_DISABLED, "Manual baseline source is disabled.");
  }

  if (budget.sourceStrategy === NEXT_FY_SOURCE_STRATEGIES.APPROVED_LE) {
    const rows = await loadApprovedLeSourceLines(connection, budget.sourceEntityId);
    if (!rows.length) throw nextFyError(422, NEXT_FY_ERROR_CODES.NEXT_FY_SOURCE_INELIGIBLE, "Approved LE source has no eligible rows.");
    return rows.map((line) => normalizeSourceLine(line, budget.targetFinancialYear));
  }

  if (budget.sourceStrategy === NEXT_FY_SOURCE_STRATEGIES.CURRENT_BUDGET) {
    const rows = await loadEligibleBudgetSourceLines(connection, budget.sourceFinancialYear);
    if (!rows.length) throw nextFyError(422, NEXT_FY_ERROR_CODES.NEXT_FY_SOURCE_INELIGIBLE, "Current Budget source has no approved or locked rows.");
    return rows.map((line) => normalizeSourceLine(line, budget.targetFinancialYear));
  }

  if (budget.sourceStrategy === NEXT_FY_SOURCE_STRATEGIES.HYBRID) {
    const leRows = budget.sourceEntityId ? await loadApprovedLeSourceLines(connection, budget.sourceEntityId) : [];
    const budgetRows = await loadEligibleBudgetSourceLines(connection, budget.sourceFinancialYear);
    const byKey = new Map();
    budgetRows.forEach((line) => byKey.set(`${String(line.coding).toUpperCase()}|${line.location}`, line));
    leRows.forEach((line) => byKey.set(`${String(line.coding).toUpperCase()}|${line.location}`, line));
    if (!byKey.size) throw nextFyError(422, NEXT_FY_ERROR_CODES.NEXT_FY_SOURCE_INELIGIBLE, "Hybrid source has no eligible approved rows.");
    return Array.from(byKey.values()).map((line) => normalizeSourceLine(line, budget.targetFinancialYear));
  }

  throw nextFyError(422, NEXT_FY_ERROR_CODES.NEXT_FY_SOURCE_INELIGIBLE, "Next FY source strategy is not eligible.");
}

function buildGeneratedLines(sourceLines, rules) {
  return sourceLines.map((line) => {
    const assumption = chooseAssumptionRule(rules, line);
    const calculated = calculateNextFyLine({
      sourceAmount: line.sourceAmount,
      growthPercentage: assumption.growthPercentage,
      fixedAdjustmentAmount: assumption.fixedAdjustmentAmount,
      manualAdjustmentAmount: 0
    });
    return Object.assign({}, line, calculated, {
      assumption,
      assumptionRuleId: assumption.rule && assumption.rule.id,
      manualAdjustmentAmount: 0,
      adjustmentReason: "",
      validationStatus: VALIDATION_STATUS.VALID
    });
  });
}

function summarizeGenerated(lines) {
  return lines.reduce((acc, line) => {
    acc.totalSourceAmount += Number(line.sourceAmount || 0);
    acc.totalGeneratedAmount += Number(line.generatedAmount || 0);
    acc.totalManualAdjustment += Number(line.manualAdjustmentAmount || 0);
    acc.totalFinalAmount += Number(line.finalBudgetAmount || 0);
    acc.generatedLineCount += 1;
    if (!line.assumption || !line.assumption.rule) acc.zeroGrowthDefaultLines += 1;
    if (line.assumption && line.assumption.ambiguous) acc.ambiguousRuleCount += 1;
    acc.affectedLocations.add(line.location || "");
    acc.affectedCodings.add(line.coding || "");
    const ruleKey = line.assumption && line.assumption.rule ? line.assumption.rule.ruleType : "DEFAULT_ZERO_GROWTH";
    acc.appliedRuleCounts[ruleKey] = (acc.appliedRuleCounts[ruleKey] || 0) + 1;
    return acc;
  }, {
    sourceRecordCount: lines.length,
    generatedLineCount: 0,
    totalSourceAmount: 0,
    totalGeneratedAmount: 0,
    totalManualAdjustment: 0,
    totalFinalAmount: 0,
    zeroGrowthDefaultLines: 0,
    ambiguousRuleCount: 0,
    unmatchedLineCount: 0,
    appliedRuleCounts: {},
    affectedLocations: new Set(),
    affectedCodings: new Set()
  });
}

function serializePreview(summary) {
  return Object.assign({}, summary, {
    estimatedIncreaseDecrease: Math.round((summary.totalGeneratedAmount - summary.totalSourceAmount) * 100) / 100,
    affectedLocations: Array.from(summary.affectedLocations).filter(Boolean).sort(),
    affectedCodings: Array.from(summary.affectedCodings).filter(Boolean).sort()
  });
}

async function createNextFyBudget(payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    if (payload.sourceStrategy === NEXT_FY_SOURCE_STRATEGIES.MANUAL_BASELINE && !featureConfig(context.config).allowManualBaseline) {
      throw nextFyError(403, NEXT_FY_ERROR_CODES.NEXT_FY_MANUAL_BASELINE_DISABLED, "Manual baseline source is disabled.");
    }
    const budget = await insertBudget(connection, payload, actor);
    const workflow = await createWorkflow(
      connection,
      {
        workflowType: WORKFLOW_TYPES.NEXT_FY,
        entityType: ENTITY_TYPES.NEXT_FY_BUDGET,
        entityId: String(budget.id),
        budgetCycleId: budget.budgetCycleId,
        initialState: NEXT_FY_STATES.GENERATED
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
        remarks: payload.generationRemarks || "Next FY workflow created.",
        metadata: { nextFyBudgetId: budget.id, sourceStrategy: budget.sourceStrategy },
        requestId: context.requestId || "",
        idempotencyKey: payload.idempotencyKey || ""
      },
      actor
    );
    const linked = await updateBudgetWorkflow(connection, budget.id, workflow.id);
    await writeAuditEvent(
      connection,
      {
        entityType: "next_fy_budgets",
        entityId: budget.id,
        action: "CREATE",
        newData: { budgetId: budget.id, sourceStrategy: budget.sourceStrategy, targetFinancialYear: budget.targetFinancialYear },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return { budget: linked, workflow };
  }, { requestId: context.requestId || "" });
}

async function getNextFyBudget(id) {
  const budget = await findBudgetById(getPool(), id);
  if (!budget) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget not found.");
  return budget;
}

async function listNextFyBudgets(filters) {
  return listBudgets(getPool(), filters);
}

async function saveAssumptionRule(budgetId, payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const budget = await findBudgetById(connection, budgetId);
    if (!budget) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget not found.");
    ensureEditable(budget);
    const rule = await insertOrUpdateRule(connection, budget.id, payload, actor);
    await writeAuditEvent(
      connection,
      {
        entityType: "planning_assumption_rules",
        entityId: rule.id,
        action: payload.id ? "UPDATE" : "CREATE",
        newData: { nextFyBudgetId: budget.id, ruleType: rule.ruleType, priority: rule.priority },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return rule;
  }, { requestId: context.requestId || "" });
}

async function previewGeneration(budgetId, context = {}) {
  const connection = getPool();
  const budget = await findBudgetById(connection, budgetId);
  if (!budget) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget not found.");
  const rules = await listRules(connection, budget.id);
  const sourceLines = await loadSourceLines(connection, budget, context.config || {});
  const generated = buildGeneratedLines(sourceLines, rules);
  return {
    budget,
    preview: serializePreview(summarizeGenerated(generated)),
    sampleLines: generated.slice(0, 25)
  };
}

async function generateNextFyBudget(budgetId, payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const budget = await findBudgetById(connection, budgetId);
    if (!budget) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget not found.");
    ensureEditable(budget);
    if (Number(payload.expectedVersion) !== Number(budget.versionNumber)) {
      throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_VERSION_CONFLICT, "Next FY budget version conflict.", {
        budgetId: budget.id,
        currentVersion: budget.versionNumber
      });
    }
    const duplicate = await findGenerationBatch(connection, budget.id, payload.idempotencyKey);
    if (duplicate) {
      return { budget, idempotent: true, generatedLineCount: Number(duplicate.generated_line_count || 0) };
    }
    const currentSummary = await getSummary(connection, budget.id);
    if (currentSummary.adjustedLines > 0) {
      throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_REGENERATION_BLOCKED, "Regeneration is blocked because manual adjustments already exist.");
    }
    const rules = await listRules(connection, budget.id);
    const sourceLines = await loadSourceLines(connection, budget, context.config || {});
    const generated = buildGeneratedLines(sourceLines, rules);
    assertNoAmbiguousRules(generated);
    const summary = summarizeGenerated(generated);
    await replaceGeneratedLines(connection, budget.id, generated, actor);
    const affected = await incrementBudgetVersionAndTotals(connection, budget.id, budget.versionNumber, summary, actor);
    if (!affected) throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_VERSION_CONFLICT, "Next FY budget version conflict.");
    await insertGenerationBatch(connection, {
      nextFyBudgetId: budget.id,
      idempotencyKey: payload.idempotencyKey,
      expectedVersion: payload.expectedVersion,
      sourceRecordCount: summary.sourceRecordCount,
      generatedLineCount: summary.generatedLineCount,
      totalSourceAmount: summary.totalSourceAmount,
      totalGeneratedAmount: summary.totalGeneratedAmount,
      status: "COMMITTED",
      requestId: context.requestId || ""
    });
    await writeAuditEvent(
      connection,
      {
        entityType: "next_fy_budgets",
        entityId: budget.id,
        action: "GENERATE",
        newData: { generatedLineCount: summary.generatedLineCount, versionBefore: budget.versionNumber, versionAfter: budget.versionNumber + 1 },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return {
      budget: Object.assign({}, budget, {
        versionNumber: budget.versionNumber + 1,
        totalSourceAmount: summary.totalSourceAmount,
        totalGeneratedAmount: summary.totalGeneratedAmount,
        totalManualAdjustment: summary.totalManualAdjustment,
        totalFinalAmount: summary.totalFinalAmount
      }),
      idempotent: false,
      generatedLineCount: summary.generatedLineCount,
      summary: serializePreview(summary)
    };
  }, { requestId: context.requestId || "" });
}

async function getLines(budgetId, filters) {
  await getNextFyBudget(budgetId);
  return listLines(getPool(), budgetId, filters);
}

async function bulkAdjustLines(budgetId, payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const budget = await findBudgetById(connection, budgetId);
    if (!budget) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget not found.");
    ensureEditable(budget);
    if (Number(payload.expectedVersion) !== Number(budget.versionNumber)) {
      throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_VERSION_CONFLICT, "Next FY budget version conflict.", { currentVersion: budget.versionNumber });
    }
    let changed = 0;
    for (const change of payload.lines) {
      const line = await findLineById(connection, budget.id, change.lineId);
      if (!line) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget line not found.");
      if (Number(change.expectedLineVersion) !== Number(line.lineVersion)) {
        throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_LINE_VERSION_CONFLICT, "Next FY line version conflict.", { lineId: line.id, currentVersion: line.lineVersion });
      }
      const requestedFinal = change.requestedFinalAmount === null || change.requestedFinalAmount === undefined || change.requestedFinalAmount === ""
        ? null
        : Number(change.requestedFinalAmount);
      const manual = requestedFinal === null
        ? Number(change.manualAdjustmentAmount || 0)
        : Math.round((requestedFinal - line.generatedAmount) * 100) / 100;
      if (manual !== 0 && !String(change.adjustmentReason || "").trim()) {
        throw nextFyError(400, NEXT_FY_ERROR_CODES.NEXT_FY_ADJUSTMENT_REASON_REQUIRED, "Adjustment reason is required for manual Next FY changes.", { lineId: line.id });
      }
      const finalBudgetAmount = Math.round((line.generatedAmount + manual) * 100) / 100;
      const affected = await updateLineAdjustment(connection, budget.id, line, {
        manualAdjustmentAmount: manual,
        finalBudgetAmount,
        adjustmentReason: change.adjustmentReason || "",
        validationStatus: VALIDATION_STATUS.VALID
      }, actor);
      if (!affected) throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_LINE_VERSION_CONFLICT, "Next FY line version conflict.", { lineId: line.id });
      await insertAdjustmentHistory(connection, {
        nextFyBudgetId: budget.id,
        lineId: line.id,
        previousManualAdjustment: line.manualAdjustmentAmount,
        newManualAdjustment: manual,
        previousFinalAmount: line.finalBudgetAmount,
        newFinalAmount: finalBudgetAmount,
        differenceAmount: Math.round((finalBudgetAmount - line.finalBudgetAmount) * 100) / 100,
        adjustmentType: requestedFinal === null ? "MANUAL_ADJUSTMENT" : "SET_FINAL_AMOUNT",
        adjustmentReason: change.adjustmentReason || "",
        requestId: context.requestId || ""
      }, actor);
      changed += 1;
    }
    const summary = await getSummary(connection, budget.id);
    const affectedBudget = await incrementBudgetVersionAndTotals(connection, budget.id, budget.versionNumber, summary, actor);
    if (!affectedBudget) throw nextFyError(409, NEXT_FY_ERROR_CODES.NEXT_FY_VERSION_CONFLICT, "Next FY budget version conflict.");
    await writeAuditEvent(
      connection,
      {
        entityType: "next_fy_budgets",
        entityId: budget.id,
        action: "BULK_ADJUST",
        newData: { changedLineCount: changed, versionBefore: budget.versionNumber, versionAfter: budget.versionNumber + 1 },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return { budget: Object.assign({}, budget, { versionNumber: budget.versionNumber + 1 }), changedLineCount: changed, summary };
  }, { requestId: context.requestId || "" });
}

async function getNextFySummary(budgetId) {
  await getNextFyBudget(budgetId);
  return getSummary(getPool(), budgetId);
}

async function transitionNextFyWorkflow(budgetId, payload, context = {}) {
  const actor = context.actor || SYSTEM_ACTOR;
  return withTransaction(async (connection) => {
    const budget = await findBudgetById(connection, budgetId);
    if (!budget) throw nextFyError(404, NEXT_FY_ERROR_CODES.NEXT_FY_NOT_FOUND, "Next FY budget not found.");
    const workflow = budget.workflowInstanceId ? await findWorkflowById(connection, budget.workflowInstanceId) : null;
    if (!workflow) throw workflowError(404, WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND, "Workflow not found.");
    const duplicate = await findHistoryByIdempotencyKey(connection, workflow.id, payload.idempotencyKey);
    if (duplicate) {
      return {
        budgetId: budget.id,
        workflowId: workflow.id,
        previousState: duplicate.fromState,
        currentState: duplicate.toState,
        version: workflow.versionNumber,
        idempotent: true
      };
    }
    if (payload.expectedVersion !== null && Number(payload.expectedVersion) !== Number(workflow.versionNumber)) {
      throw workflowError(409, WORKFLOW_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow version conflict. Refresh and retry.");
    }
    const transition = validateTransition({
      workflowType: workflow.workflowType,
      currentState: workflow.currentState,
      action: payload.action,
      remarks: payload.remarks,
      isLocked: workflow.currentState === NEXT_FY_STATES.LOCKED
    });
    const affected = await updateWorkflowState(connection, {
      id: workflow.id,
      expectedVersion: workflow.versionNumber,
      nextState: transition.nextState,
      isLocked: transition.nextState === NEXT_FY_STATES.LOCKED,
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
        metadata: { nextFyBudgetId: budget.id },
        requestId: context.requestId || "",
        idempotencyKey: payload.idempotencyKey || ""
      },
      actor
    );
    await connection.execute("UPDATE next_fy_budgets SET status = ?, updated_at = NOW() WHERE id = ?", [transition.nextState, budget.id]);
    await writeAuditEvent(
      connection,
      {
        entityType: "next_fy_budgets",
        entityId: budget.id,
        action: `TRANSITION_${transition.action}`,
        oldData: { status: workflow.currentState },
        newData: { status: transition.nextState },
        changedBy: actor.displayName,
        requestId: context.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return {
      budgetId: budget.id,
      workflowId: workflow.id,
      previousState: workflow.currentState,
      currentState: transition.nextState,
      version: workflow.versionNumber + 1,
      idempotent: false
    };
  }, { requestId: context.requestId || "" });
}

module.exports = {
  actorFromRequest,
  bulkAdjustLines,
  createNextFyBudget,
  generateNextFyBudget,
  getLines,
  getNextFyBudget,
  getNextFySummary,
  listNextFyBudgets,
  loadSourceLines,
  previewGeneration,
  saveAssumptionRule,
  transitionNextFyWorkflow
};
