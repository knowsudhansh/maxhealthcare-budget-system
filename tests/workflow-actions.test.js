const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const { app } = require("../server");
const { closePool, initializePool, resetPoolForTests } = require("../src/db/pool");
const {
  BUDGET_STATES,
  WORKFLOW_ACTIONS,
  WORKFLOW_PERMISSIONS
} = require("../src/modules/workflow/workflow.constants");
const {
  assertBudgetRecordMutable,
  availableActionsForWorkflow,
  getApprovalQueue,
  getBudgetWorkflowSummary
} = require("../src/modules/workflow/workflow.service");

function baseConfig() {
  return {
    db: {
      host: "localhost",
      port: 3306,
      database: "budget",
      user: "user",
      password: "password",
      ssl: false,
      connectionLimit: 10,
      connectTimeoutMs: 10000
    }
  };
}

function workflowRow(row) {
  return {
    id: row.id,
    workflow_type: row.workflowType || "BUDGET",
    entity_type: row.entityType || "BUDGET_SUBMISSION",
    entity_id: row.entityId,
    budget_cycle_id: row.budgetCycleId || 0,
    current_state: row.currentState,
    version_number: row.versionNumber || 1,
    is_locked: row.isLocked ? 1 : 0,
    created_by: "system",
    updated_by: "system",
    created_at: "2026-07-22T00:00:00.000Z",
    updated_at: "2026-07-22T00:00:00.000Z"
  };
}

function createWorkflowActionsDb(options = {}) {
  const state = {
    workflows: options.workflows || [],
    queueRows: options.queueRows || [],
    summaryStates: options.summaryStates || [],
    summaryActions: options.summaryActions || []
  };

  async function execute(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized === "select 1") return [[]];

    if (normalized.includes("from workflow_instances") && normalized.includes("where id = ?")) {
      const found = state.workflows.find((row) => row.id === Number(params[0]));
      return [[found ? workflowRow(found) : undefined].filter(Boolean)];
    }

    if (normalized.includes("from workflow_instances") && normalized.includes("workflow_type = ?")) {
      const found = state.workflows.find(
        (row) =>
          (row.workflowType || "BUDGET") === params[0] &&
          (row.entityType || "BUDGET_SUBMISSION") === params[1] &&
          String(row.entityId) === String(params[2]) &&
          Number(row.budgetCycleId || 0) === Number(params[3] || 0)
      );
      return [[found ? workflowRow(found) : undefined].filter(Boolean)];
    }

    if (normalized.includes("select count(*) as total") && normalized.includes("from workflow_instances w")) {
      return [[{ total: state.queueRows.length }]];
    }

    if (normalized.includes("from workflow_instances w") && normalized.includes("left join budget_submissions b")) {
      return [
        state.queueRows.map((row) => ({
          ...workflowRow(row.workflow),
          coding: row.record.coding,
          item: row.record.item,
          location: row.record.location,
          financial_year: row.record.financialYear,
          owner: row.record.owner,
          loc_fy_current: row.record.locFyCurrent
        }))
      ];
    }

    if (normalized.includes("coalesce(w.current_state, 'not_started') as state")) {
      return [state.summaryStates];
    }

    if (normalized.includes("from workflow_history h") && normalized.includes("h.action in")) {
      return [state.summaryActions];
    }

    throw new Error(`Unexpected SQL in workflow actions test: ${normalized}`);
  }

  return {
    query: execute,
    execute,
    getConnection: async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute
    }),
    end: async () => {}
  };
}

async function setupPool(fakePool) {
  resetPoolForTests();
  await initializePool(baseConfig(), null, {
    mysql: {
      createPool: () => fakePool
    }
  });
}

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = appInstance.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function requestJson(server, requestPath) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: requestPath, method: "GET" }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const startOnly = availableActionsForWorkflow(null);
  assert.strictEqual(startOnly.length, 1);
  assert.strictEqual(startOnly[0].action, "START_WORKFLOW");
  assert.strictEqual(startOnly[0].permission, WORKFLOW_PERMISSIONS.START);

  assert.deepStrictEqual(
    availableActionsForWorkflow({ workflowType: "BUDGET", currentState: BUDGET_STATES.DRAFT, isLocked: false }).map((item) => item.action),
    [WORKFLOW_ACTIONS.SUBMIT]
  );
  assert.deepStrictEqual(
    availableActionsForWorkflow({ workflowType: "BUDGET", currentState: BUDGET_STATES.SUBMITTED, isLocked: false }).map((item) => item.action),
    [WORKFLOW_ACTIONS.START_REVIEW, WORKFLOW_ACTIONS.RETURN_TO_DRAFT, WORKFLOW_ACTIONS.REJECT]
  );
  assert.deepStrictEqual(
    availableActionsForWorkflow({ workflowType: "BUDGET", currentState: BUDGET_STATES.UNDER_REVIEW, isLocked: false }).map((item) => item.action),
    [WORKFLOW_ACTIONS.APPROVE, WORKFLOW_ACTIONS.RETURN_TO_DRAFT]
  );
  assert.deepStrictEqual(
    availableActionsForWorkflow({ workflowType: "BUDGET", currentState: BUDGET_STATES.APPROVED, isLocked: false }).map((item) => item.action),
    [WORKFLOW_ACTIONS.LOCK]
  );
  assert.deepStrictEqual(
    availableActionsForWorkflow({ workflowType: "BUDGET", currentState: BUDGET_STATES.LOCKED, isLocked: true }),
    []
  );

  await setupPool(
    createWorkflowActionsDb({
      workflows: [
        { id: 1, entityId: "10", currentState: BUDGET_STATES.DRAFT },
        { id: 2, entityId: "20", currentState: BUDGET_STATES.SUBMITTED },
        { id: 3, entityId: "30", currentState: BUDGET_STATES.LOCKED, isLocked: true }
      ],
      queueRows: [
        {
          workflow: { id: 2, entityId: "20", currentState: BUDGET_STATES.SUBMITTED, versionNumber: 2 },
          record: {
            coding: "ITOPEX009",
            item: "CRM License Renewal (Sales force)",
            location: "Saket",
            financialYear: "2026-27",
            owner: "Akshant",
            locFyCurrent: 100000
          }
        }
      ],
      summaryStates: [
        { state: "NOT_STARTED", count_value: 3 },
        { state: "DRAFT", count_value: 1 },
        { state: "SUBMITTED", count_value: 1 }
      ],
      summaryActions: [{ action: "RETURN_TO_DRAFT", count_value: 2 }]
    })
  );

  assert.deepStrictEqual(await assertBudgetRecordMutable("10", "edit", { enforce: true }), { allowed: true, state: "DRAFT" });
  await assert.rejects(
    () => assertBudgetRecordMutable("20", "edit", { enforce: true }),
    (error) => error.publicCode === "BUDGET_WORKFLOW_EDIT_RESTRICTED"
  );
  await assert.rejects(
    () => assertBudgetRecordMutable("30", "delete", { enforce: true }),
    (error) => error.publicCode === "BUDGET_WORKFLOW_DELETE_RESTRICTED"
  );
  assert.deepStrictEqual(await assertBudgetRecordMutable("20", "edit", { enforce: false }), {
    allowed: true,
    state: "NOT_ENFORCED"
  });

  const queue = await getApprovalQueue({ state: "SUBMITTED", pageSize: 500 });
  assert.strictEqual(queue.pageSize, 100);
  assert.strictEqual(queue.total, 1);
  assert.strictEqual(queue.rows[0].record.coding, "ITOPEX009");
  assert.ok(queue.rows[0].workflow.availableActions.some((item) => item.action === WORKFLOW_ACTIONS.START_REVIEW));

  const summary = await getBudgetWorkflowSummary({});
  assert.strictEqual(summary.states.NOT_STARTED, 3);
  assert.strictEqual(summary.states.SUBMITTED, 1);
  assert.strictEqual(summary.actions.RETURN_TO_DRAFT, 2);

  const server = await listen(app);
  try {
    const actions = await requestJson(server, "/api/workflows/2/actions");
    assert.strictEqual(actions.statusCode, 200);
    assert.ok(actions.body.data.some((item) => item.action === WORKFLOW_ACTIONS.START_REVIEW));
    const queueResponse = await requestJson(server, "/api/workflows/queue?workflowType=BUDGET&state=SUBMITTED&pageSize=10");
    assert.strictEqual(queueResponse.statusCode, 200);
    assert.strictEqual(queueResponse.body.data.total, 1);
    const summaryResponse = await requestJson(server, "/api/workflows/summary");
    assert.strictEqual(summaryResponse.statusCode, 200);
    assert.strictEqual(summaryResponse.body.data.states.DRAFT, 1);
  } finally {
    await closeServer(server);
    await closePool();
  }

  const appUi = fs.readFileSync(path.join(__dirname, "..", "app-ui.js"), "utf8");
  const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(appUi.includes('data-action="workflow-start"'));
  assert.ok(appUi.includes('data-action="workflow-transition-open"'));
  assert.ok(appUi.includes("Budget Approval Queue"));
  assert.ok(appUi.includes("Budget Workflow Dashboard"));
  assert.ok(appJs.includes("expectedVersion"));
  assert.ok(appJs.includes("idempotencyKey"));
  assert.ok(appJs.includes("workflow-transition-confirm"));

  resetPoolForTests();
  console.log("Workflow action tests passed.");
}

run().catch(async (error) => {
  await closePool();
  console.error(error);
  process.exit(1);
});
