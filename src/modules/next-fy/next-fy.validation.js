const { validationError } = require("../../errors/app-error");
const { parseFinancialNumber, parsePositiveInteger, sanitizeString, validateFinancialYear } = require("../../validation/common");
const { ASSUMPTION_RULE_TYPES, NEXT_FY_SOURCE_STRATEGIES } = require("./next-fy.constants");
const { NEXT_FY_ERROR_CODES, nextFyError } = require("./next-fy.errors");

const SOURCE_STRATEGIES = new Set(Object.values(NEXT_FY_SOURCE_STRATEGIES));
const RULE_TYPES = new Set(Object.values(ASSUMPTION_RULE_TYPES));
const SORT_FIELDS = new Set(["coding", "location", "owner", "owner1", "category", "sourceAmount", "finalBudgetAmount", "updatedAt"]);

function parseFyStart(year) {
  const fy = validateFinancialYear(year, "financialYear");
  return Number(fy.slice(0, 4));
}

function validateTargetFinancialYear(sourceYear, targetYear) {
  let sourceStart;
  let targetStart;
  try {
    sourceStart = parseFyStart(sourceYear);
  } catch (error) {
    throw nextFyError(400, NEXT_FY_ERROR_CODES.NEXT_FY_INVALID_SOURCE_YEAR, "Source financial year is invalid.");
  }
  try {
    targetStart = parseFyStart(targetYear);
  } catch (error) {
    throw nextFyError(400, NEXT_FY_ERROR_CODES.NEXT_FY_INVALID_TARGET_YEAR, "Target financial year is invalid.");
  }
  if (targetStart !== sourceStart + 1) {
    throw nextFyError(422, NEXT_FY_ERROR_CODES.NEXT_FY_YEAR_SEQUENCE_INVALID, "Target financial year must immediately follow the source financial year.", {
      sourceFinancialYear: sourceYear,
      targetFinancialYear: targetYear
    });
  }
  return validateFinancialYear(targetYear, "targetFinancialYear");
}

function normalizeListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || query.page_size || "25", 10) || 25));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    targetFinancialYear: sanitizeString(query.targetFinancialYear || query.target_financial_year || "", 20),
    location: sanitizeString(query.location || "", 120),
    coding: sanitizeString(query.coding || "", 80),
    category: sanitizeString(query.category || "", 255),
    owner: sanitizeString(query.owner || "", 120),
    sourceType: sanitizeString(query.sourceType || query.source_type || "", 40).toUpperCase(),
    status: sanitizeString(query.status || "", 40).toUpperCase(),
    sortField: SORT_FIELDS.has(String(query.sortField || "")) ? String(query.sortField) : "coding",
    sortDirection: String(query.sortDirection || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC"
  };
}

function normalizeCreateBudgetPayload(body = {}) {
  const sourceStrategy = sanitizeString(body.sourceStrategy || body.source_strategy, 40).toUpperCase();
  if (!SOURCE_STRATEGIES.has(sourceStrategy)) {
    throw validationError("sourceStrategy is invalid.");
  }
  const sourceFinancialYear = validateFinancialYear(body.sourceFinancialYear || body.source_financial_year, "sourceFinancialYear");
  const targetFinancialYear = validateTargetFinancialYear(sourceFinancialYear, body.targetFinancialYear || body.target_financial_year);
  return {
    budgetCode: sanitizeString(body.budgetCode || body.budget_code || `NEXTFY-${targetFinancialYear}-${Date.now()}`, 100),
    budgetName: sanitizeString(body.budgetName || body.budget_name || `Next FY Budget ${targetFinancialYear}`, 255),
    budgetCycleId: body.budgetCycleId || body.budget_cycle_id ? parsePositiveInteger(body.budgetCycleId || body.budget_cycle_id, "budgetCycleId") : 0,
    sourceStrategy,
    sourceEntityId: sanitizeString(body.sourceEntityId || body.source_entity_id || "", 80),
    sourceVersion: body.sourceVersion || body.source_version ? parsePositiveInteger(body.sourceVersion || body.source_version, "sourceVersion") : 1,
    sourceFinancialYear,
    targetFinancialYear,
    generationRemarks: sanitizeString(body.generationRemarks || body.generation_remarks || "", 2000),
    idempotencyKey: sanitizeString(body.idempotencyKey || body.idempotency_key || "", 160)
  };
}

function normalizeAssumptionPayload(body = {}) {
  const ruleType = sanitizeString(body.ruleType || body.rule_type || ASSUMPTION_RULE_TYPES.GLOBAL_GROWTH, 50).toUpperCase();
  if (!RULE_TYPES.has(ruleType)) throw validationError("ruleType is invalid.");
  return {
    id: body.id ? parsePositiveInteger(body.id, "assumptionRuleId") : null,
    ruleName: sanitizeString(body.ruleName || body.rule_name || ruleType, 180),
    ruleType,
    priority: Number.isInteger(Number(body.priority)) ? Number(body.priority) : 100,
    location: sanitizeString(body.location || "", 120),
    coding: sanitizeString(body.coding || "", 50),
    category: sanitizeString(body.category || "", 255),
    owner: sanitizeString(body.owner || "", 120),
    growthPercentage: parseFinancialNumber(body.growthPercentage ?? body.growth_percentage ?? 0, "growthPercentage", { required: true }),
    fixedAdjustmentAmount: parseFinancialNumber(body.fixedAdjustmentAmount ?? body.fixed_adjustment_amount ?? 0, "fixedAdjustmentAmount"),
    minimumAmount: body.minimumAmount ?? body.minimum_amount ? parseFinancialNumber(body.minimumAmount ?? body.minimum_amount, "minimumAmount", { nullable: true }) : null,
    maximumAmount: body.maximumAmount ?? body.maximum_amount ? parseFinancialNumber(body.maximumAmount ?? body.maximum_amount, "maximumAmount", { nullable: true }) : null,
    isActive: body.isActive ?? body.is_active ?? true,
    remarks: sanitizeString(body.remarks || "", 2000)
  };
}

function normalizeGeneratePayload(body = {}) {
  return {
    expectedVersion: parsePositiveInteger(body.expectedVersion ?? body.expected_version, "expectedVersion"),
    idempotencyKey: sanitizeString(body.idempotencyKey || body.idempotency_key, 160),
    generationRemarks: sanitizeString(body.generationRemarks || body.generation_remarks || "", 2000)
  };
}

function normalizeAdjustmentPayload(body = {}, maxLines = 500) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) throw validationError("At least one Next FY line adjustment is required.");
  if (lines.length > maxLines) throw validationError(`Bulk adjustment is limited to ${maxLines} changed lines.`);
  return {
    expectedVersion: parsePositiveInteger(body.expectedVersion ?? body.expected_version, "expectedVersion"),
    idempotencyKey: sanitizeString(body.idempotencyKey || body.idempotency_key, 160),
    lines: lines.map((line, index) => ({
      lineId: parsePositiveInteger(line.lineId ?? line.line_id, `lines[${index}].lineId`),
      expectedLineVersion: parsePositiveInteger(line.expectedLineVersion ?? line.expected_line_version, `lines[${index}].expectedLineVersion`),
      manualAdjustmentAmount: line.manualAdjustmentAmount ?? line.manual_adjustment_amount ?? null,
      requestedFinalAmount: line.requestedFinalAmount ?? line.requested_final_amount ?? null,
      adjustmentReason: sanitizeString(line.adjustmentReason || line.adjustment_reason || "", 2000),
      clientChangeId: sanitizeString(line.clientChangeId || line.client_change_id || "", 120)
    }))
  };
}

module.exports = {
  normalizeAdjustmentPayload,
  normalizeAssumptionPayload,
  normalizeCreateBudgetPayload,
  normalizeGeneratePayload,
  normalizeListQuery,
  validateTargetFinancialYear
};
