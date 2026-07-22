const { LE_VARIANCE_SEVERITIES } = require("./latest-estimate.constants");

function toFiniteAmount(value, name = "amount") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new Error(`${name} must be a finite number.`);
    error.code = "LE_INVALID_AMOUNT";
    throw error;
  }
  return Math.round(number * 100) / 100;
}

function normalizeThresholds(input = {}) {
  return {
    warningPercent: Number.isFinite(Number(input.warningPercent)) ? Math.abs(Number(input.warningPercent)) : 10,
    materialPercent: Number.isFinite(Number(input.materialPercent)) ? Math.abs(Number(input.materialPercent)) : 20,
    warningAmount: Number.isFinite(Number(input.warningAmount)) ? Math.abs(Number(input.warningAmount)) : 100000,
    materialAmount: Number.isFinite(Number(input.materialAmount)) ? Math.abs(Number(input.materialAmount)) : 500000
  };
}

function severityRank(value) {
  return {
    [LE_VARIANCE_SEVERITIES.ON_BUDGET]: 0,
    [LE_VARIANCE_SEVERITIES.WITHIN_THRESHOLD]: 1,
    [LE_VARIANCE_SEVERITIES.WARNING]: 2,
    [LE_VARIANCE_SEVERITIES.MATERIAL]: 3,
    [LE_VARIANCE_SEVERITIES.ZERO_BASE_INCREASE]: 4
  }[value] || 0;
}

function moreSevere(a, b) {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function calculateVariance(input = {}, thresholdInput = {}) {
  const budgetAmount = toFiniteAmount(input.budgetAmount || 0, "budgetAmount");
  const latestEstimateAmount = toFiniteAmount(input.latestEstimateAmount || 0, "latestEstimateAmount");
  const thresholds = normalizeThresholds(thresholdInput);
  const varianceAmount = Math.round((latestEstimateAmount - budgetAmount) * 100) / 100;
  const absVariance = Math.abs(varianceAmount);

  let variancePercentage = 0;
  let severity = LE_VARIANCE_SEVERITIES.ON_BUDGET;
  let thresholdRule = "exact-match";

  if (budgetAmount === 0) {
    if (latestEstimateAmount === 0) {
      return {
        budgetAmount,
        latestEstimateAmount,
        varianceAmount,
        variancePercentage: 0,
        varianceSeverity: severity,
        thresholdRule
      };
    }
    return {
      budgetAmount,
      latestEstimateAmount,
      varianceAmount,
      variancePercentage: null,
      varianceSeverity: LE_VARIANCE_SEVERITIES.ZERO_BASE_INCREASE,
      thresholdRule: "zero-budget-non-zero-le"
    };
  }

  variancePercentage = Math.round((varianceAmount / Math.abs(budgetAmount)) * 10000) / 100;
  const absPercent = Math.abs(variancePercentage);

  if (absVariance > 0) {
    severity = LE_VARIANCE_SEVERITIES.WITHIN_THRESHOLD;
    thresholdRule = "variance-non-zero";
  }
  if (absPercent >= thresholds.warningPercent || absVariance >= thresholds.warningAmount) {
    severity = moreSevere(severity, LE_VARIANCE_SEVERITIES.WARNING);
    thresholdRule = "warning-threshold";
  }
  if (absPercent >= thresholds.materialPercent || absVariance >= thresholds.materialAmount) {
    severity = moreSevere(severity, LE_VARIANCE_SEVERITIES.MATERIAL);
    thresholdRule = "material-threshold";
  }

  return {
    budgetAmount,
    latestEstimateAmount,
    varianceAmount,
    variancePercentage,
    varianceSeverity: severity,
    thresholdRule
  };
}

function requiresRemarks(variance) {
  return [
    LE_VARIANCE_SEVERITIES.MATERIAL,
    LE_VARIANCE_SEVERITIES.ZERO_BASE_INCREASE
  ].includes(variance && variance.varianceSeverity);
}

module.exports = {
  calculateVariance,
  normalizeThresholds,
  requiresRemarks,
  toFiniteAmount
};
