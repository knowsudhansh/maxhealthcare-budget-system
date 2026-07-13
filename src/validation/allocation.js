const { AppError, ERROR_CODES, validationError } = require("../errors/app-error");
const {
  parseFinancialNumber,
  parsePositiveInteger,
  sanitizeString,
  validateFinancialYear,
  validatePercentage
} = require("./common");

function parseJsonObject(value, fieldName) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (_error) {
      throw validationError(`${fieldName} must be a valid JSON object.`);
    }
  }
  throw validationError(`${fieldName} must be an object.`);
}

function normalizeAmountMap(value, fieldName = "locationAmounts") {
  const object = parseJsonObject(value, fieldName) || {};
  const normalized = {};
  Object.keys(object).forEach((location) => {
    const key = sanitizeString(location, 120);
    if (!key) return;
    const amount = parseFinancialNumber(object[location], `${fieldName}.${key}`, {
      allowFormatted: true
    });
    if (amount < 0) {
      throw validationError(`${fieldName}.${key} must not be negative.`);
    }
    normalized[key] = amount;
  });
  return normalized;
}

function normalizePercentMap(value, fieldName = "locationPercents") {
  const object = parseJsonObject(value, fieldName) || {};
  const normalized = {};
  Object.keys(object).forEach((location) => {
    const key = sanitizeString(location, 120);
    if (!key) return;
    normalized[key] = validatePercentage(object[location], `${fieldName}.${key}`, {
      allowFormatted: true
    });
  });
  return normalized;
}

function sumAmountMap(value) {
  return Object.keys(value || {}).reduce((sum, key) => sum + Number(value[key] || 0), 0);
}

function validateAllocationRecordPayload(payload = {}) {
  const amountInput =
    payload.amountInput === "" || payload.amountInput == null
      ? null
      : parseFinancialNumber(payload.amountInput, "amountInput", {
          allowFormatted: true,
          nullable: true
        });
  const percentInput =
    payload.percentInput === "" || payload.percentInput == null
      ? null
      : validatePercentage(payload.percentInput, "percentInput", {
          allowFormatted: true,
          nullable: true
        });
  const targetAmount = parseFinancialNumber(payload.targetAmount, "targetAmount", {
    allowFormatted: true
  });

  if (amountInput !== null && amountInput < 0) throw validationError("amountInput must not be negative.");
  if (targetAmount < 0) throw validationError("targetAmount must not be negative.");

  const coding = sanitizeString(payload.coding || payload.Coding, 50);
  const owner = sanitizeString(payload.owner || payload.Owner, 100);
  const financialYear = validateFinancialYear(
    payload.financialYear || payload["Financial Year"] || payload.year,
    "financialYear"
  );

  if (!coding || !owner || !financialYear) {
    throw validationError("Missing coding/owner/financialYear.");
  }

  return {
    coding,
    owner,
    financialYear,
    item: sanitizeString(payload.item || payload.Item, 255),
    mode: sanitizeString(payload.mode || payload.Mode || "Distributed", 40) || "Distributed",
    amountInput,
    percentInput,
    targetAmount,
    recordVersion:
      payload.recordVersion == null || payload.recordVersion === ""
        ? null
        : parsePositiveInteger(payload.recordVersion, "recordVersion")
  };
}

function validateAllocationMatrixPayload(body = {}) {
  const financialYear = validateFinancialYear(
    body.financialYear || body.financial_year || body["Financial Year"],
    "financialYear"
  );
  const coding = sanitizeString(body.coding || body.Coding, 50);
  const owner = sanitizeString(body.owner || body.Owner, 100);
  if (!coding || !owner) {
    throw validationError("Missing financialYear/coding/owner.");
  }

  const totalBudget = parseFinancialNumber(
    body.totalBudget || body.total_budget || body.targetAmount,
    "totalBudget",
    { allowFormatted: true }
  );
  if (totalBudget < 0) throw validationError("totalBudget must not be negative.");

  const rawAmounts = body.locationAmounts || body.location_amounts || body.location_amounts_json || null;
  const rawPercents = body.locationPercents || body.location_percents || body.location_percents_json || null;

  return {
    financialYear,
    coding,
    item: sanitizeString(body.item || body.Item, 255),
    owner,
    costDistribution:
      sanitizeString(body.costDistribution || body.cost_distribution || body.mode || "Distributed", 40) ||
      "Distributed",
    totalBudget,
    explicitAmounts: rawAmounts ? normalizeAmountMap(rawAmounts) : null,
    explicitPercents: rawPercents ? normalizePercentMap(rawPercents) : null,
    recordVersion:
      body.recordVersion == null || body.recordVersion === ""
        ? null
        : parsePositiveInteger(body.recordVersion, "recordVersion")
  };
}

function validateAllocatedTotal(total, expected, tolerance = 0.05) {
  if (Math.abs(Number(total || 0) - Number(expected || 0)) > tolerance) {
    throw new AppError({
      statusCode: 422,
      publicCode: ERROR_CODES.ALLOCATION_TOTAL_INVALID,
      publicMessage: "Allocated amount total does not match the expected total."
    });
  }
}

module.exports = {
  normalizeAmountMap,
  normalizePercentMap,
  sumAmountMap,
  validateAllocatedTotal,
  validateAllocationMatrixPayload,
  validateAllocationRecordPayload
};
