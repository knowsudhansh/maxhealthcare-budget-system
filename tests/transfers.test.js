const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadEnvironment } = require("../src/config/environment");
const {
  ENTITY_TYPES,
  TRANSFER_STATES,
  WORKFLOW_ACTIONS,
  WORKFLOW_TYPES
} = require("../src/modules/workflow/workflow.constants");
const { getNextState, validateTransition } = require("../src/modules/workflow/workflow.transitions");
const {
  buildPostingEntries,
  buildReversalEntries,
  computeWorkingBudget
} = require("../src/modules/transfers/transfer.ledger");
const {
  normalizeActionPayload,
  normalizeTransferCreatePayload
} = require("../src/modules/transfers/transfer.validation");

const repoRoot = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function testLedgerFormula() {
  const result = computeWorkingBudget({
    originalBudget: 100000,
    incomingTransfers: 25000,
    outgoingTransfers: 10000
  });
  assert.strictEqual(result.originalBudget, 100000);
  assert.strictEqual(result.incomingTransfers, 25000);
  assert.strictEqual(result.outgoingTransfers, 10000);
  assert.strictEqual(result.workingBudget, 115000);
  assert.strictEqual(result.availableBalance, 115000);
  assert.strictEqual(result.remainingBudget, 115000);
}

function testPostingEntries() {
  const line = {
    id: 7,
    sourceBudgetLineId: 10,
    destinationBudgetLineId: 11,
    transferAmount: 125000.5,
    currency: "INR"
  };
  const request = { id: 3, financialYear: "2026-27" };
  const entries = buildPostingEntries(line, request);
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].budgetLineId, 10);
  assert.strictEqual(entries[0].amount, -125000.5);
  assert.strictEqual(entries[1].budgetLineId, 11);
  assert.strictEqual(entries[1].amount, 125000.5);
  const reversal = buildReversalEntries(Object.assign({ id: 22 }, entries[0]));
  assert.strictEqual(reversal.amount, 125000.5);
  assert.strictEqual(reversal.reversalOfPostingId, 22);
}

function testValidation() {
  const payload = normalizeTransferCreatePayload({
    transferType: "coding_to_coding",
    financialYear: "2026-27",
    reason: "UAT balance correction",
    lines: [{
      sourceBudgetLineId: 1,
      destinationBudgetLineId: 2,
      transferAmount: "1,00,000.50"
    }]
  });
  assert.strictEqual(payload.transferType, "CODING_TO_CODING");
  assert.strictEqual(payload.lines[0].transferAmount, 100000.5);
  assert.strictEqual(payload.lines[0].sourceBudgetLineId, 1);
  assert.throws(() => normalizeTransferCreatePayload({
    financialYear: "2026-27",
    lines: [{ sourceBudgetLineId: 1, destinationBudgetLineId: 1, transferAmount: 10 }]
  }), /different/);
  assert.throws(() => normalizeTransferCreatePayload({
    financialYear: "2026-27",
    lines: [{ sourceBudgetLineId: 1, destinationBudgetLineId: 2, transferAmount: 0 }]
  }), /greater than zero/);

  const action = normalizeActionPayload({ expectedVersion: 1, remarks: "Posting approved", idempotencyKey: "abc" });
  assert.strictEqual(action.expectedVersion, 1);
}

function testWorkflowTransitions() {
  assert.strictEqual(getNextState(WORKFLOW_TYPES.TRANSFER, TRANSFER_STATES.DRAFT, WORKFLOW_ACTIONS.SUBMIT), TRANSFER_STATES.SUBMITTED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.TRANSFER, TRANSFER_STATES.SUBMITTED, WORKFLOW_ACTIONS.START_REVIEW), TRANSFER_STATES.UNDER_REVIEW);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.TRANSFER, TRANSFER_STATES.UNDER_REVIEW, WORKFLOW_ACTIONS.APPROVE), TRANSFER_STATES.APPROVED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.TRANSFER, TRANSFER_STATES.APPROVED, WORKFLOW_ACTIONS.POST), TRANSFER_STATES.POSTED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.TRANSFER, TRANSFER_STATES.POSTED, WORKFLOW_ACTIONS.REVERSE), TRANSFER_STATES.REVERSED);
  assert.strictEqual(getNextState(WORKFLOW_TYPES.TRANSFER, TRANSFER_STATES.CANCELLED, WORKFLOW_ACTIONS.SUBMIT), "");
  assert.throws(() => validateTransition({
    workflowType: WORKFLOW_TYPES.TRANSFER,
    currentState: TRANSFER_STATES.APPROVED,
    action: WORKFLOW_ACTIONS.POST,
    remarks: "",
    isLocked: false
  }), /Remarks are required/);
}

function testMigrationSafety() {
  const sql = read("migrations/012_budget_transfer_foundation.sql");
  [
    "budget_transfer_requests",
    "budget_transfer_lines",
    "budget_transfer_postings",
    "budget_transfer_history",
    "working_budget_balances"
  ].forEach((table) => {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} should be additive`);
  });
  assert.ok(sql.includes("UNIQUE KEY uk_budget_transfer_number"));
  assert.ok(sql.includes("UNIQUE KEY uk_working_budget_line_year"));
  const activeSql = sql.replace(/-- Rollback guidance[\s\S]*$/i, "");
  assert.ok(!/DROP\s+TABLE/i.test(activeSql));
  assert.ok(!/TRUNCATE/i.test(activeSql));
  assert.ok(!/UPDATE\s+budget_submissions/i.test(activeSql));
  assert.ok(!/UPDATE\s+latest_estimate/i.test(activeSql));
  assert.ok(!/UPDATE\s+next_fy/i.test(activeSql));
}

function testStaticWiring() {
  const server = read("server.js");
  assert.ok(server.includes("createTransferRouter"));
  assert.ok(server.includes("transferModuleEnabled"));
  const routes = read("src/modules/transfers/transfer.routes.js");
  ["/transfers", "/submit", "/review", "/approve", "/return", "/reject", "/post", "/reverse", "/working-budget"].forEach((fragment) => {
    assert.ok(routes.includes(fragment), `${fragment} route should exist`);
  });
  const service = read("src/modules/transfers/transfer.service.js");
  ["withTransaction", "buildPostingEntries", "buildReversalEntries", "writeAuditEvent", "validateLineBudget"].forEach((fragment) => {
    assert.ok(service.includes(fragment), `${fragment} should be used`);
  });
  assert.ok(!service.includes("UPDATE budget_submissions"));
  const repository = read("src/modules/transfers/transfer.repository.js");
  assert.ok(repository.includes("budget_submissions"));
  assert.ok(!repository.includes("UPDATE budget_submissions"));
  const html = read("index.html");
  assert.ok(html.includes("transferView"));
  const ui = read("app-ui.js");
  assert.ok(ui.includes("renderTransfer"));
  assert.ok(ui.includes("Working Budget = Original Approved Budget + Incoming Transfers - Outgoing Transfers"));
  const app = read("app.js");
  assert.ok(app.includes("apiUrl(\"transfers\""));
  assert.ok(app.includes("transfer-create"));
}

function testEnvironmentFlags() {
  const config = loadEnvironment({
    APP_ENV: "development",
    DB_HOST: "localhost",
    DB_NAME: "budget_app",
    DB_USER: "user",
    DB_PASSWORD: "password",
    TRANSFER_MODULE_ENABLED: "true",
    TRANSFER_POSTING_ENABLED: "false",
    TRANSFER_REVERSAL_ENABLED: "true"
  });
  assert.strictEqual(config.features.transferModuleEnabled, true);
  assert.strictEqual(config.features.transferPostingEnabled, false);
  assert.strictEqual(config.features.transferReversalEnabled, true);
  assert.strictEqual(ENTITY_TYPES.TRANSFER, "TRANSFER");
}

testLedgerFormula();
testPostingEntries();
testValidation();
testWorkflowTransitions();
testMigrationSafety();
testStaticWiring();
testEnvironmentFlags();

console.log("Transfer tests passed.");
