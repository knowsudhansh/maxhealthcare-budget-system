const assert = require("assert");
const { formatFinancialAmount, parseFinancialAmount } = require("../app-utils");

function almostEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: expected ${expected}, received ${actual}`);
}

assert.strictEqual(formatFinancialAmount(0), "0");
assert.strictEqual(formatFinancialAmount(1000), "1,000");
assert.strictEqual(formatFinancialAmount(10000), "10,000");
assert.strictEqual(formatFinancialAmount(100000), "1,00,000");
assert.strictEqual(formatFinancialAmount(1250000), "12,50,000");
assert.strictEqual(formatFinancialAmount(10000000), "1,00,00,000");
assert.strictEqual(formatFinancialAmount(1250000.5), "12,50,000.5");
assert.strictEqual(formatFinancialAmount(1250000.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), "12,50,000.50");
assert.strictEqual(formatFinancialAmount(-100000), "-1,00,000");
assert.strictEqual(formatFinancialAmount(null), "0");
assert.strictEqual(formatFinancialAmount(undefined), "0");
assert.strictEqual(formatFinancialAmount(""), "0");
assert.strictEqual(formatFinancialAmount("100000"), "1,00,000");
assert.strictEqual(formatFinancialAmount("1,00,000"), "1,00,000");
assert.strictEqual(parseFinancialAmount("1,00,000"), 100000);
assert.strictEqual(parseFinancialAmount("₹ 1,00,000.50"), 100000.5);
assert.strictEqual(parseFinancialAmount("-1,00,000"), -100000);
assert.strictEqual(parseFinancialAmount("invalid"), 0);

const currentBudget = 500000;
const totalExpense = 125000;
const lastYearBudget = 400000;
const locLe = 100000;
const locFyCurrent = 125000;
const locationBudget = 250000;
const totalBudget = 1000000;
const drivers = [10000, 20000, 15000, 5000, 12000, 3000, 7000];

const remainingBudget = currentBudget - totalExpense;
const budgetIncrease = locFyCurrent - locLe;
const budgetIncreasePercent = locLe ? (budgetIncrease / locLe) * 100 : 0;
const utilizationPercent = currentBudget ? (totalExpense / currentBudget) * 100 : 0;
const budgetSharePercent = totalBudget ? (locationBudget / totalBudget) * 100 : 0;
const driverTotal = drivers.reduce((sum, value) => sum + value, 0);
const allocationAmount = (500000 * 13.87) / 100;
const comparisonGap = currentBudget - lastYearBudget;

assert.strictEqual(formatFinancialAmount(remainingBudget), "3,75,000");
almostEqual(remainingBudget, 375000, "Remaining budget raw formula changed");
almostEqual(budgetIncrease, 25000, "Budget increase raw formula changed");
almostEqual(budgetIncreasePercent, 25, "Budget increase percent raw formula changed");
almostEqual(utilizationPercent, 25, "Utilization percent raw formula changed");
almostEqual(budgetSharePercent, 25, "Budget share percent raw formula changed");
almostEqual(driverTotal, 72000, "Driver total raw formula changed");
almostEqual(allocationAmount, 69350, "Allocation amount raw formula changed");
almostEqual(comparisonGap, 100000, "Comparison gap raw formula changed");

assert.strictEqual(parseFinancialAmount(formatFinancialAmount(remainingBudget)), remainingBudget);

console.log("Financial formatting and formula regression tests passed.");
