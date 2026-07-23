const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadEnvironment } = require("../src/config/environment");
const { NEXT_FY_STATES, WORKFLOW_ACTIONS, WORKFLOW_TYPES } = require("../src/modules/workflow/workflow.constants");
const { getNextState, validateTransition } = require("../src/modules/workflow/workflow.transitions");
const { chooseAssumptionRule } = require("../src/modules/next-fy/next-fy.assumptions");
const { ASSUMPTION_RULE_TYPES, NEXT_FY_SOURCE_STRATEGIES } = require("../src/modules/next-fy/next-fy.constants");
const { calculateNextFyLine } = require("../src/modules/next-fy/next-fy.generator");
const { validateTargetFinancialYear, normalizeCreateBudgetPayload, normalizeAdjustmentPayload } = require("../src/modules/next-fy/next-fy.validation");

const repoRoot = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function testGenerationFormula() {
  const result = calculateNextFyLine({
    sourceAmount: 100000,
    growthPercentage: 10,
    fixedAdjustmentAmount: 5000,
    manualAdjustmentAmount: -2000
  });
  assert.strictEqual(result.growthAmount, 10000);
  assert.strictEqual(result.generatedAmount, 115000);
  assert.strictEqual(result.finalBudgetAmount, 113000);
  assert.strictEqual(result.differenceAmount, 13000);

  const zero = calculateNextFyLine({ sourceAmount: 0, growthPercentage: 25, fixedAdjustmentAmount: 1000 });
  assert.strictEqual(zero.generatedAmount, 1000);
  assert.strictEqual(zero.finalBudgetAmount, 1000);
  assert.throws(() => calculateNextFyLine({ sourceAmount: "invalid" }), /finite number/);
}

function testAssumptionPriority() {
  const line = { coding: "ITOPEX009", location: "Saket", category: "Application", owner: "Akshant" };
  const rules = [
    { id: 1, ruleType: ASSUMPTION_RULE_TYPES.GLOBAL_GROWTH, priority: 100, growthPercentage: 3 },
    { id: 2, ruleType: ASSUMPTION_RULE_TYPES.LOCATION_GROWTH, priority: 100, location: "Saket", growthPercentage: 5 },
    { id: 3, ruleType: ASSUMPTION_RULE_TYPES.CODING_LOCATION_GROWTH, priority: 100, coding: "ITOPEX009", location: "Saket", growthPercentage: 8 }
  ];
  const selected = chooseAssumptionRule(rules, line);
  assert.strictEqual(selected.rule.id, 3);
  assert.strictEqual(selected.growthPercentage, 8);
  assert.strictEqual(selected.ambiguous, false);

  const ambiguous = chooseAssumptionRule([
    { id: 10, ruleType: ASSUMPTION_RULE_TYPES.CODING_GROWTH, priority: 1, coding: "ITOPEX009", growthPercentage: 6 },
    { id: 11, ruleType: ASSUMPTION_RULE_TYPES.CODING_GROWTH, priority: 1, coding: "ITOPEX009", growthPercentage: 7 }
  ], line);
  assert.strictEqual(ambiguous.ambiguous, true);
}

function testFinancialYearValidation() {
  assert.strictEqual(validateTargetFinancialYear("2025-26", "2026-27"), "2026-27");
  assert.throws(() => validateTargetFinancialYear("2025-26", "2025-26"), /Target financial year/);
  assert.throws(() => validateTargetFinancialYear("bad", "2026-27"), /Source financial year/);
}

function testPayloadValidation() {
  const payload = normalizeCreateBudgetPayload({
    sourceStrategy: NEXT_FY_SOURCE_STRATEGIES.CURRENT_BUDGET,
    sourceFinancialYear: "2025-26",
    targetFinancialYear: "2026-27",
    budgetName: "Next FY",
    generationRemarks: "UAT generation"
  });
  assert.strictEqual(payload.sourceStrategy, NEXT_FY_SOURCE_STRATEGIES.CURRENT_BUDGET);
  assert.strictEqual(payload.targetFinancialYear, "2026-27");

  const adjustment = normalizeAdjustmentPayload({
    expectedVersion: 1,
    idempotencyKey: "nextfy-test-key",
    lines: [{ lineId: 1, expectedLineVersion: 2, manualAdjustmentAmount: 0, adjustmentReason: "" }]
  });
  assert.strictEqual(adjustment.lines[0].manualAdjustmentAmount, 0);
}

function testWorkflowTransitions() {
  assert.strictEqual(getNextState(WORKFLOW_TYPES.NEXT_FY, NEXT_FY_STATES.GENERATED, WORKFLOW_ACTIONS.START_REVIEW), NEXT_FY_STATES.UNDER_REVIEW);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.NEXT_FY, NEXT_FY_STATES.UNDER_REVIEW, WORKFLOW_ACTIONS.APPROVE), NEXT_FY_STATES.APPROVED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.NEXT_FY, NEXT_FY_STATES.APPROVED, WORKFLOW_ACTIONS.LOCK), NEXT_FY_STATES.LOCKED);
  assert.throws(() => validateTransition({
    workflowType: WORKFLOW_TYPES.NEXT_FY,
    currentState: NEXT_FY_STATES.UNDER_REVIEW,
    action: WORKFLOW_ACTIONS.RETURN_TO_GENERATED,
    remarks: "",
    isLocked: false
  }), /Remarks are required/);
}

function testMigrationSafety() {
  const sql = read("migrations/011_next_fy_budget_foundation.sql");
  ["next_fy_budgets", "next_fy_budget_lines", "planning_assumption_rules", "next_fy_generation_batches", "next_fy_adjustment_history"].forEach((table) => {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} should be additive`);
  });
  assert.ok(sql.includes("UNIQUE KEY uk_next_fy_budget_code"));
  assert.ok(sql.includes("UNIQUE KEY uk_next_fy_line_identity"));
  const activeSql = sql.replace(/-- Rollback guidance[\s\S]*$/i, "");
  assert.ok(!/DROP\s+TABLE/i.test(activeSql));
  assert.ok(!/TRUNCATE/i.test(activeSql));
  assert.ok(!/DELETE\s+FROM\s+budget_submissions/i.test(activeSql));
  assert.ok(!/UPDATE\s+latest_estimate_/i.test(activeSql));
}

function testStaticWiring() {
  const server = read("server.js");
  assert.ok(server.includes("createNextFyRouter"));
  assert.ok(server.includes("nextFyBudgetEnabled"));
  const routes = read("src/modules/next-fy/next-fy.routes.js");
  ["/next-fy/budgets", "/generate", "/lines/bulk-adjust", "/workflow/transitions"].forEach((fragment) => {
    assert.ok(routes.includes(fragment), `${fragment} route should exist`);
  });
  const service = read("src/modules/next-fy/next-fy.service.js");
  ["withTransaction", "loadApprovedLeSourceLines", "loadEligibleBudgetSourceLines", "findGenerationBatch", "writeAuditEvent"].forEach((fragment) => {
    assert.ok(service.includes(fragment), `${fragment} should be used`);
  });
  const app = read("app.js");
  assert.ok(app.includes("nextfy-create-budget"));
  assert.ok(app.includes("apiUrl(`next-fy/budgets"));
  const html = read("index.html");
  assert.ok(html.includes("nextFyView"));
  const ui = read("app-ui.js");
  assert.ok(ui.includes("renderNextFy"));
  assert.ok(ui.includes("nextfy-line-input"));
}

function testEnvironmentFlags() {
  const config = loadEnvironment({
    APP_ENV: "development",
    DB_HOST: "localhost",
    DB_NAME: "budget_app",
    DB_USER: "user",
    DB_PASSWORD: "password",
    NEXT_FY_BUDGET_ENABLED: "true",
    NEXT_FY_ALLOW_MANUAL_BASELINE: "false",
    NEXT_FY_MAX_BULK_LINES: "250"
  });
  assert.strictEqual(config.features.nextFyBudgetEnabled, true);
  assert.strictEqual(config.features.nextFyAllowManualBaseline, false);
  assert.strictEqual(config.features.nextFyMaxBulkLines, 250);
}

testGenerationFormula();
testAssumptionPriority();
testFinancialYearValidation();
testPayloadValidation();
testWorkflowTransitions();
testMigrationSafety();
testStaticWiring();
testEnvironmentFlags();

console.log("Next FY tests passed.");
