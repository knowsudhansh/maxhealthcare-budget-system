const { validationError } = require("../../errors/app-error");
const { parseFinancialNumber, parsePositiveInteger, sanitizeString, validateFinancialYear } = require("../../validation/common");
const { TRANSFER_TYPES } = require("./transfer.constants");

const VALID_TRANSFER_TYPES = new Set(Object.values(TRANSFER_TYPES));

function normalizeListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || query.page_size || "25", 10) || 25));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    status: sanitizeString(query.status || "", 40).toUpperCase(),
    transferType: sanitizeString(query.transferType || query.transfer_type || "", 60).toUpperCase(),
    financialYear: sanitizeString(query.financialYear || query.financial_year || "", 20),
    coding: sanitizeString(query.coding || "", 80),
    location: sanitizeString(query.location || "", 120)
  };
}

function normalizeTransferCreatePayload(body = {}) {
  const transferType = sanitizeString(body.transferType || body.transfer_type || TRANSFER_TYPES.PARTIAL_TRANSFER, 60).toUpperCase();
  if (!VALID_TRANSFER_TYPES.has(transferType)) throw validationError("transferType is invalid.");
  const financialYear = validateFinancialYear(body.financialYear || body.financial_year, "financialYear");
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) throw validationError("At least one transfer line is required.");
  if (lines.length > 100) throw validationError("Transfer request is limited to 100 lines.");
  return {
    transferNumber: sanitizeString(body.transferNumber || body.transfer_number || `TRF-${financialYear}-${Date.now()}`, 100),
    transferType,
    reason: sanitizeString(body.reason, 2000),
    priority: sanitizeString(body.priority || "NORMAL", 30).toUpperCase(),
    financialYear,
    remarks: sanitizeString(body.remarks || "", 2000),
    idempotencyKey: sanitizeString(body.idempotencyKey || body.idempotency_key || "", 160),
    lines: lines.map((line, index) => normalizeTransferLine(line, index, transferType))
  };
}

function normalizeTransferLine(line = {}, index = 0, transferType) {
  const sourceBudgetLineId = parsePositiveInteger(line.sourceBudgetLineId || line.source_budget_line_id, `lines[${index}].sourceBudgetLineId`);
  const destinationBudgetLineId = parsePositiveInteger(line.destinationBudgetLineId || line.destination_budget_line_id, `lines[${index}].destinationBudgetLineId`);
  if (sourceBudgetLineId === destinationBudgetLineId) {
    throw validationError("Source and destination budget lines must be different.");
  }
  const amount = parseFinancialNumber(line.transferAmount ?? line.transfer_amount, `lines[${index}].transferAmount`, { required: true, allowFormatted: true });
  if (amount <= 0) throw validationError("Transfer amount must be greater than zero.");
  return {
    sourceBudgetLineId,
    destinationBudgetLineId,
    sourceCoding: sanitizeString(line.sourceCoding || line.source_coding || "", 50),
    destinationCoding: sanitizeString(line.destinationCoding || line.destination_coding || "", 50),
    sourceDepartment: sanitizeString(line.sourceDepartment || line.source_department || "", 120),
    destinationDepartment: sanitizeString(line.destinationDepartment || line.destination_department || "", 120),
    sourceLocation: sanitizeString(line.sourceLocation || line.source_location || "", 120),
    destinationLocation: sanitizeString(line.destinationLocation || line.destination_location || "", 120),
    sourceOwner: sanitizeString(line.sourceOwner || line.source_owner || "", 120),
    destinationOwner: sanitizeString(line.destinationOwner || line.destination_owner || "", 120),
    sourceCategory: sanitizeString(line.sourceCategory || line.source_category || "", 255),
    destinationCategory: sanitizeString(line.destinationCategory || line.destination_category || "", 255),
    transferAmount: amount,
    currency: sanitizeString(line.currency || "INR", 10),
    transferType: sanitizeString(line.transferType || line.transfer_type || transferType, 60).toUpperCase(),
    remarks: sanitizeString(line.remarks || "", 2000)
  };
}

function normalizeActionPayload(body = {}) {
  return {
    expectedVersion: parsePositiveInteger(body.expectedVersion ?? body.expected_version, "expectedVersion"),
    idempotencyKey: sanitizeString(body.idempotencyKey || body.idempotency_key || "", 160),
    remarks: sanitizeString(body.remarks || "", 2000)
  };
}

module.exports = {
  normalizeActionPayload,
  normalizeListQuery,
  normalizeTransferCreatePayload,
  normalizeTransferLine
};
