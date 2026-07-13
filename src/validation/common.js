const { validationError } = require("../errors/app-error");

const YEAR_PATTERN = /^\d{4}-\d{2}$/;

function sanitizeString(value, maxLength = 255) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) {
    throw validationError(`Text value exceeds ${maxLength} characters.`);
  }
  return text;
}

function parseFinancialNumber(value, fieldName, options = {}) {
  const { required = false, allowFormatted = false, nullable = false } = options;
  if (value === "" || value === null || value === undefined) {
    if (nullable) return null;
    if (required) throw validationError(`${fieldName} is required.`);
    return 0;
  }

  let normalized = value;
  if (typeof value === "string") {
    normalized = value.trim();
    if (allowFormatted) {
      normalized = normalized.replace(/[₹,\s]/g, "");
    }
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw validationError(`${fieldName} must be a valid number.`);
  }
  return number;
}

function parsePositiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }
  return number;
}

function validateFinancialYear(value, fieldName = "financialYear") {
  const text = sanitizeString(value, 20);
  if (!YEAR_PATTERN.test(text)) {
    throw validationError(`${fieldName} must use YYYY-YY format.`);
  }
  return text;
}

function validatePercentage(value, fieldName, options = {}) {
  const number = parseFinancialNumber(value, fieldName, options);
  if (number < 0 || number > 100) {
    throw validationError(`${fieldName} must be between 0 and 100.`);
  }
  return number;
}

module.exports = {
  parseFinancialNumber,
  parsePositiveInteger,
  sanitizeString,
  validateFinancialYear,
  validatePercentage
};
