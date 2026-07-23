function toMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function computeWorkingBudget({ originalBudget = 0, incomingTransfers = 0, outgoingTransfers = 0 }) {
  const original = toMoney(originalBudget);
  const incoming = toMoney(incomingTransfers);
  const outgoing = toMoney(outgoingTransfers);
  const workingBudget = toMoney(original + incoming - outgoing);
  return {
    originalBudget: original,
    incomingTransfers: incoming,
    outgoingTransfers: outgoing,
    workingBudget,
    availableBalance: workingBudget,
    transferredAmount: toMoney(incoming + outgoing),
    remainingBudget: workingBudget
  };
}

function buildPostingEntries(line, request) {
  const amount = toMoney(line.transferAmount || line.transfer_amount);
  return [
    {
      transferRequestId: request.id,
      transferLineId: line.id,
      postingType: "DEBIT_SOURCE",
      budgetLineId: line.sourceBudgetLineId,
      amount: -amount,
      currency: line.currency || "INR",
      financialYear: request.financialYear
    },
    {
      transferRequestId: request.id,
      transferLineId: line.id,
      postingType: "CREDIT_DESTINATION",
      budgetLineId: line.destinationBudgetLineId,
      amount,
      currency: line.currency || "INR",
      financialYear: request.financialYear
    }
  ];
}

function buildReversalEntries(posting) {
  return {
    transferRequestId: posting.transferRequestId || posting.transfer_request_id,
    transferLineId: posting.transferLineId || posting.transfer_line_id,
    postingType: posting.postingType === "DEBIT_SOURCE" ? "REVERSAL_CREDIT_SOURCE" : "REVERSAL_DEBIT_DESTINATION",
    budgetLineId: posting.budgetLineId || posting.budget_line_id,
    amount: toMoney(-Number(posting.amount || 0)),
    currency: posting.currency || "INR",
    financialYear: posting.financialYear || posting.financial_year,
    reversalOfPostingId: posting.id
  };
}

module.exports = {
  buildPostingEntries,
  buildReversalEntries,
  computeWorkingBudget,
  toMoney
};
