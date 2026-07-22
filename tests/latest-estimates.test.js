const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { calculateVariance, requiresRemarks } = require("../src/modules/latest-estimates/latest-estimate.variance");
const { normalizeBulkSavePayload } = require("../src/modules/latest-estimates/latest-estimate.validation");
const { LE_VARIANCE_SEVERITIES } = require("../src/modules/latest-estimates/latest-estimate.constants");
const { LE_STATES, WORKFLOW_ACTIONS, WORKFLOW_TYPES } = require("../src/modules/workflow/workflow.constants");
const { getNextState, validateTransition } = require("../src/modules/workflow/workflow.transitions");

function readProject(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function run() {
  assert.deepStrictEqual(calculateVariance({ budgetAmount: 100000, latestEstimateAmount: 100000 }), {
    budgetAmount: 100000,
    latestEstimateAmount: 100000,
    varianceAmount: 0,
    variancePercentage: 0,
    varianceSeverity: LE_VARIANCE_SEVERITIES.ON_BUDGET,
    thresholdRule: "exact-match"
  });

  const increase = calculateVariance({ budgetAmount: 100000, latestEstimateAmount: 125000 }, {
    warningPercent: 10,
    materialPercent: 20,
    warningAmount: 100000,
    materialAmount: 500000
  });
  assert.strictEqual(increase.varianceAmount, 25000);
  assert.strictEqual(increase.variancePercentage, 25);
  assert.strictEqual(increase.varianceSeverity, LE_VARIANCE_SEVERITIES.MATERIAL);
  assert.strictEqual(requiresRemarks(increase), true);

  const decrease = calculateVariance({ budgetAmount: 100000, latestEstimateAmount: 95000 }, {
    warningPercent: 10,
    materialPercent: 20,
    warningAmount: 100000,
    materialAmount: 500000
  });
  assert.strictEqual(decrease.varianceAmount, -5000);
  assert.strictEqual(decrease.variancePercentage, -5);
  assert.strictEqual(decrease.varianceSeverity, LE_VARIANCE_SEVERITIES.WITHIN_THRESHOLD);
  assert.strictEqual(requiresRemarks(decrease), false);

  const zeroToZero = calculateVariance({ budgetAmount: 0, latestEstimateAmount: 0 });
  assert.strictEqual(zeroToZero.variancePercentage, 0);
  assert.strictEqual(zeroToZero.varianceSeverity, LE_VARIANCE_SEVERITIES.ON_BUDGET);

  const zeroIncrease = calculateVariance({ budgetAmount: 0, latestEstimateAmount: 1 });
  assert.strictEqual(zeroIncrease.variancePercentage, null);
  assert.strictEqual(zeroIncrease.varianceSeverity, LE_VARIANCE_SEVERITIES.ZERO_BASE_INCREASE);
  assert.strictEqual(requiresRemarks(zeroIncrease), true);
  assert.ok(!JSON.stringify(zeroIncrease).includes("Infinity"));
  assert.ok(!JSON.stringify(zeroIncrease).includes("NaN"));

  const amountWins = calculateVariance({ budgetAmount: 10000000, latestEstimateAmount: 10600000 }, {
    warningPercent: 10,
    materialPercent: 20,
    warningAmount: 100000,
    materialAmount: 500000
  });
  assert.strictEqual(amountWins.variancePercentage, 6);
  assert.strictEqual(amountWins.varianceSeverity, LE_VARIANCE_SEVERITIES.MATERIAL);

  assert.throws(() => calculateVariance({ budgetAmount: "invalid", latestEstimateAmount: 1 }), /finite number/);

  const zeroPayload = normalizeBulkSavePayload({
    expectedMatrixVersion: 1,
    idempotencyKey: "zero-le",
    cells: [
      {
        budgetEntityId: "10",
        coding: "ITOPEX009",
        location: "Saket",
        financialYear: "2026-27",
        latestEstimateAmount: 0,
        remarks: ""
      }
    ]
  });
  assert.strictEqual(zeroPayload.cells[0].latestEstimateAmount, 0);

  assert.strictEqual(getNextState(WORKFLOW_TYPES.LE, LE_STATES.DRAFT, WORKFLOW_ACTIONS.SUBMIT), LE_STATES.SUBMITTED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.LE, LE_STATES.SUBMITTED, WORKFLOW_ACTIONS.VALIDATE), LE_STATES.VALIDATED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.LE, LE_STATES.VALIDATED, WORKFLOW_ACTIONS.APPROVE), LE_STATES.APPROVED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.LE, LE_STATES.APPROVED, WORKFLOW_ACTIONS.SUBMIT), "");
  assert.throws(
    () =>
      validateTransition({
        workflowType: WORKFLOW_TYPES.LE,
        currentState: LE_STATES.SUBMITTED,
        action: WORKFLOW_ACTIONS.REJECT,
        remarks: "",
        isLocked: false
      }),
    /Remarks are required/
  );

  const migration = readProject("migrations/010_latest_estimate_foundation.sql");
  assert.ok(/CREATE TABLE IF NOT EXISTS latest_estimate_matrices/i.test(migration));
  assert.ok(/CREATE TABLE IF NOT EXISTS latest_estimate_cells/i.test(migration));
  assert.ok(/CREATE TABLE IF NOT EXISTS variance_logs/i.test(migration));
  assert.ok(/CREATE TABLE IF NOT EXISTS latest_estimate_save_batches/i.test(migration));
  assert.ok(/UNIQUE KEY uk_le_cell_identity/i.test(migration));
  assert.ok(!/\bDROP\s+TABLE\b(?![\s\S]*Rollback guidance)/i.test(migration.replace(/-- Rollback guidance:[\s\S]*/i, "")));
  assert.ok(!/\bTRUNCATE\b/i.test(migration));
  assert.ok(!/\bDELETE\s+FROM\s+budget_submissions\b/i.test(migration));

  const server = readProject("server.js");
  assert.ok(server.includes("createLatestEstimateRouter"));
  assert.ok(server.includes("latestEstimateEnabled"));
  assert.ok(server.includes("leWorkflowEnforcementEnabled"));

  const routes = readProject("src/modules/latest-estimates/latest-estimate.routes.js");
  [
    "/latest-estimates/matrices",
    "/latest-estimates/matrices/:matrixId/cells",
    "/latest-estimates/matrices/:matrixId/cells/bulk-save",
    "/latest-estimates/matrices/:matrixId/summary",
    "/latest-estimates/matrices/:matrixId/workflow/transitions"
  ].forEach((route) => assert.ok(routes.includes(route), `Missing route ${route}`));

  const service = readProject("src/modules/latest-estimates/latest-estimate.service.js");
  assert.ok(service.includes("calculateVariance"));
  assert.ok(service.includes("requiresRemarks"));
  assert.ok(service.includes("withTransaction"));
  assert.ok(service.includes("LE_MATRIX_VERSION_CONFLICT"));
  assert.ok(service.includes("LE_CELL_VERSION_CONFLICT"));
  assert.ok(!service.includes("varianceAmount: cell.varianceAmount"));

  const appUi = readProject("app-ui.js");
  const appJs = readProject("app.js");
  const index = readProject("index.html");
  assert.ok(index.includes('data-view="latestEstimateView"'));
  assert.ok(appUi.includes("Latest Estimate Matrix"));
  assert.ok(appUi.includes('data-action="le-save-cells"'));
  assert.ok(appJs.includes('apiUrl("latest-estimates/matrices'));
  assert.ok(appJs.includes("latest-estimates/matrices/${encodeURIComponent(String(matrix.id))}/cells/bulk-save"));

  console.log("Latest Estimate tests passed.");
}

run();
