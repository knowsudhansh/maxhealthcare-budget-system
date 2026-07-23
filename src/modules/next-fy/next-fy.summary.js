function summarizeLines(lines = []) {
  return lines.reduce((summary, line) => {
    const source = Number(line.sourceAmount || line.source_amount || 0);
    const generated = Number(line.generatedAmount || line.generated_amount || 0);
    const finalAmount = Number(line.finalBudgetAmount || line.final_budget_amount || generated);
    const manualAdjustment = Number(line.manualAdjustmentAmount || line.manual_adjustment_amount || 0);
    summary.totalSourceAmount += source;
    summary.totalGeneratedAmount += generated;
    summary.totalManualAdjustment += manualAdjustment;
    summary.totalFinalAmount += finalAmount;
    if (finalAmount > source) summary.linesIncreased += 1;
    else if (finalAmount < source) summary.linesDecreased += 1;
    else summary.unchangedLines += 1;
    if (source === 0 && finalAmount !== 0) summary.newZeroBaseLines += 1;
    if (manualAdjustment !== 0) summary.adjustedLines += 1;
    if (line.validationStatus === "REASON_REQUIRED" || line.validation_status === "REASON_REQUIRED") summary.linesMissingRequiredReasons += 1;
    if (line.validationStatus === "INVALID" || line.validation_status === "INVALID") summary.invalidLines += 1;
    return summary;
  }, {
    totalSourceAmount: 0,
    totalGeneratedAmount: 0,
    totalManualAdjustment: 0,
    totalFinalAmount: 0,
    linesIncreased: 0,
    linesDecreased: 0,
    unchangedLines: 0,
    newZeroBaseLines: 0,
    adjustedLines: 0,
    linesMissingRequiredReasons: 0,
    invalidLines: 0
  });
}

module.exports = {
  summarizeLines
};
