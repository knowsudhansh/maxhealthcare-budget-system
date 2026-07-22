const { validationError } = require("../../errors/app-error");
const { parseFinancialNumber, parsePositiveInteger, sanitizeString, validateFinancialYear } = require("../../validation/common");

const SORT_FIELDS = new Set(["coding", "location", "budgetAmount", "latestEstimateAmount", "varianceAmount", "variancePercentage", "varianceSeverity", "updatedAt"]);

function normalizeMatrixCreatePayload(body = {}) {
  const financialYear = validateFinancialYear(body.financialYear || body.financial_year, "financialYear");
  const matrixCode = sanitizeString(body.matrixCode || body.matrix_code || `LE-${financialYear}-${Date.now()}`, 80);
  const matrixName = sanitizeString(body.matrixName || body.matrix_name || `Latest Estimate ${financialYear}`, 180);
  return {
    matrixCode,
    matrixName,
    budgetCycleId: body.budgetCycleId || body.budget_cycle_id ? parsePositiveInteger(body.budgetCycleId || body.budget_cycle_id, "budgetCycleId") : 0,
    financialYear,
    sourceBudgetVersion: sanitizeString(body.sourceBudgetVersion || body.source_budget_version || "budget_submissions-current", 80)
  };
}

function normalizeListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || query.page_size || "25", 10) || 25));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    financialYear: sanitizeString(query.financialYear || query.financial_year || "", 20),
    status: sanitizeString(query.status || "", 40).toUpperCase(),
    coding: sanitizeString(query.coding || "", 80),
    location: sanitizeString(query.location || "", 120),
    severity: sanitizeString(query.severity || query.varianceSeverity || "", 40).toUpperCase(),
    hasRemarks: String(query.hasRemarks || "").toLowerCase() === "true",
    changedOnly: String(query.changedOnly || query.changed_only || "").toLowerCase() === "true",
    sortField: SORT_FIELDS.has(String(query.sortField || "")) ? String(query.sortField) : "coding",
    sortDirection: String(query.sortDirection || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC"
  };
}

function normalizeBulkSavePayload(body = {}) {
  const cells = Array.isArray(body.cells) ? body.cells : [];
  if (!cells.length) throw validationError("At least one changed LE cell is required.");
  if (cells.length > 500) throw validationError("Bulk save is limited to 500 changed cells.");
  const expectedMatrixVersion = body.expectedMatrixVersion ?? body.expected_matrix_version;
  return {
    expectedMatrixVersion: parsePositiveInteger(expectedMatrixVersion, "expectedMatrixVersion"),
    idempotencyKey: sanitizeString(body.idempotencyKey || body.idempotency_key, 120),
    cells: cells.map((cell, index) => ({
      budgetEntityId: sanitizeString(cell.budgetEntityId ?? cell.budget_entity_id, 80),
      coding: sanitizeString(cell.coding, 50),
      location: sanitizeString(cell.location, 120),
      financialYear: validateFinancialYear(cell.financialYear ?? cell.financial_year, `cells[${index}].financialYear`),
      latestEstimateAmount: parseFinancialNumber(cell.latestEstimateAmount ?? cell.latest_estimate_amount, `cells[${index}].latestEstimateAmount`, { required: true, allowFormatted: true }),
      expectedCellVersion: cell.expectedCellVersion ?? cell.expected_cell_version ? parsePositiveInteger(cell.expectedCellVersion ?? cell.expected_cell_version, `cells[${index}].expectedCellVersion`) : null,
      remarks: sanitizeString(cell.remarks || "", 2000)
    }))
  };
}

module.exports = {
  normalizeBulkSavePayload,
  normalizeListQuery,
  normalizeMatrixCreatePayload
};
