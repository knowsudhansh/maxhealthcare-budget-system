const { NEXT_FY_ERROR_CODES, nextFyError } = require("./next-fy.errors");

function toFiniteAmount(value, fieldName = "amount") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw nextFyError(400, NEXT_FY_ERROR_CODES.NEXT_FY_INVALID_AMOUNT, `${fieldName} must be a finite number.`);
  }
  return Math.round(number * 100) / 100;
}

function calculateNextFyLine(input = {}) {
  const baseAmount = toFiniteAmount(input.sourceAmount || 0, "sourceAmount");
  const growthPercentage = Number(input.growthPercentage || 0);
  const fixedAdjustmentAmount = toFiniteAmount(input.fixedAdjustmentAmount || 0, "fixedAdjustmentAmount");
  const manualAdjustmentAmount = toFiniteAmount(input.manualAdjustmentAmount || 0, "manualAdjustmentAmount");
  if (!Number.isFinite(growthPercentage)) {
    throw nextFyError(400, NEXT_FY_ERROR_CODES.NEXT_FY_INVALID_AMOUNT, "growthPercentage must be a finite number.");
  }

  const growthAmount = Math.round(((baseAmount * growthPercentage) / 100) * 100) / 100;
  const generatedAmount = Math.round((baseAmount + growthAmount + fixedAdjustmentAmount) * 100) / 100;
  const finalBudgetAmount = Math.round((generatedAmount + manualAdjustmentAmount) * 100) / 100;
  const differenceAmount = Math.round((finalBudgetAmount - baseAmount) * 100) / 100;

  return {
    sourceAmount: baseAmount,
    growthPercentage,
    growthAmount,
    fixedAdjustmentAmount,
    generatedAmount,
    manualAdjustmentAmount,
    finalBudgetAmount,
    differenceAmount
  };
}

module.exports = {
  calculateNextFyLine,
  toFiniteAmount
};
