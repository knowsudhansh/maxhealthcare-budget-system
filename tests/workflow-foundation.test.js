const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const { app } = require("../server");
const { closePool, initializePool, resetPoolForTests } = require("../src/db/pool");
const { withTransaction } = require("../src/db/transaction");
const { BUDGET_STATES, WORKFLOW_ACTIONS } = require("../src/modules/workflow/workflow.constants");
const { validateTransition } = require("../src/modules/workflow/workflow.transitions");
const {
  createWorkflowInstance,
  transitionWorkflow,
  attachBudgetWorkflowStatuses
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

function createMemoryDb(options = {}) {
  const state = {
    workflows: [],
    history: [],
    cycles: [],
    nextWorkflowId: 1,
    nextHistoryId: 1,
    committed: 0,
    rolledBack: 0,
    released: 0,
    failHistory: false,
    failAudit: false,
    ...options
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function workflowRow(row) {
    return {
      id: row.id,
      workflow_type: row.workflowType,
      entity_type: row.entityType,
      entity_id: row.entityId,
      budget_cycle_id: row.budgetCycleId || 0,
      current_state: row.currentState,
      version_number: row.versionNumber,
      is_locked: row.isLocked ? 1 : 0,
      created_by: row.createdBy || "system",
      updated_by: row.updatedBy || "system",
      created_at: row.createdAt || "2026-07-22T00:00:00.000Z",
      updated_at: row.updatedAt || "2026-07-22T00:00:00.000Z"
    };
  }

  function historyRow(row) {
    return {
      id: row.id,
      workflow_instance_id: row.workflowInstanceId,
      from_state: row.fromState,
      to_state: row.toState,
      action: row.action,
      remarks: row.remarks,
      reason_code: row.reasonCode,
      metadata_json: JSON.stringify(row.metadata || {}),
      idempotency_key: row.idempotencyKey,
      request_id: row.requestId,
      performed_by: row.performedBy || "system",
      performed_at: row.performedAt || "2026-07-22T00:00:00.000Z"
    };
  }

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      state.committed += 1;
    },
    rollback: async () => {
      state.rolledBack += 1;
    },
    release: () => {
      state.released += 1;
    },
    query: async (sql) => executeQuery(sql, []),
    execute: async (sql, params = []) => executeQuery(sql, params)
  };

  async function executeQuery(sql, params) {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized === "select 1") return [[]];

    if (normalized.includes("from workflow_instances") && normalized.includes("where id = ?")) {
      const found = state.workflows.find((row) => row.id === Number(params[0]));
      return [[found ? workflowRow(found) : undefined].filter(Boolean)];
    }

    if (normalized.includes("from workflow_instances") && normalized.includes("entity_id in")) {
      const ids = params.slice(2).map(String);
      return [
        state.workflows
          .filter((row) => row.workflowType === params[0] && row.entityType === params[1] && ids.includes(String(row.entityId)))
          .map(workflowRow)
      ];
    }

    if (normalized.includes("from workflow_instances") && normalized.includes("workflow_type = ?")) {
      const found = state.workflows.find(
        (row) =>
          row.workflowType === params[0] &&
          row.entityType === params[1] &&
          row.entityId === String(params[2]) &&
          Number(row.budgetCycleId || 0) === Number(params[3] || 0)
      );
      return [[found ? workflowRow(found) : undefined].filter(Boolean)];
    }

    if (normalized.startsWith("insert into workflow_instances")) {
      state.workflows.push({
        id: state.nextWorkflowId++,
        workflowType: params[0],
        entityType: params[1],
        entityId: String(params[2]),
        budgetCycleId: Number(params[3] || 0),
        currentState: params[4],
        versionNumber: 1,
        isLocked: false,
        createdBy: params[5],
        updatedBy: params[6]
      });
      return [{ insertId: state.nextWorkflowId - 1, affectedRows: 1 }];
    }

    if (normalized.startsWith("update workflow_instances")) {
      const found = state.workflows.find((row) => row.id === Number(params[3]) && row.versionNumber === Number(params[4]));
      if (!found) return [{ affectedRows: 0 }];
      found.currentState = params[0];
      found.versionNumber += 1;
      found.isLocked = Boolean(params[1]);
      found.updatedBy = params[2];
      return [{ affectedRows: 1 }];
    }

    if (normalized.includes("from workflow_history") && normalized.includes("idempotency_key = ?")) {
      const found = state.history.find((row) => row.workflowInstanceId === Number(params[0]) && row.idempotencyKey === params[1]);
      return [[found ? historyRow(found) : undefined].filter(Boolean)];
    }

    if (normalized.includes("from workflow_history h") && normalized.includes("max(id) as max_id")) {
      const ids = params.map(Number);
      const rows = ids
        .map((id) =>
          state.history
            .filter((row) => row.workflowInstanceId === id)
            .sort((a, b) => b.id - a.id)[0]
        )
        .filter(Boolean)
        .map(historyRow);
      return [rows];
    }

    if (normalized.includes("from workflow_history") && normalized.includes("where workflow_instance_id = ?")) {
      return [state.history.filter((row) => row.workflowInstanceId === Number(params[0])).map(historyRow)];
    }

    if (normalized.startsWith("insert into workflow_history")) {
      if (state.failHistory) throw new Error("history insert failed");
      state.history.push({
        id: state.nextHistoryId++,
        workflowInstanceId: Number(params[0]),
        fromState: params[1],
        toState: params[2],
        action: params[3],
        remarks: params[4],
        reasonCode: params[5],
        metadata: params[6] ? JSON.parse(params[6]) : {},
        idempotencyKey: params[7],
        requestId: params[8],
        performedBy: params[9]
      });
      return [{ insertId: state.nextHistoryId - 1, affectedRows: 1 }];
    }

    if (normalized.startsWith("insert into audit_logs")) {
      if (state.failAudit) throw new Error("audit insert failed");
      return [{ insertId: 1, affectedRows: 1 }];
    }

    if (normalized.includes("select * from budget_cycles")) {
      return [state.cycles];
    }

    throw new Error(`Unexpected SQL in workflow test: ${normalized}`);
  }

  return {
    state,
    pool: {
      query: async (sql, params = []) => executeQuery(sql, params),
      execute: async (sql, params = []) => executeQuery(sql, params),
      getConnection: async () => connection,
      end: async () => {}
    }
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

function requestJson(server, method, requestPath, body) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : null });
        });
      }
    );
    req.on("error", reject);
    req.end(payload);
  });
}

async function run() {
  assert.deepStrictEqual(
    validateTransition({
      workflowType: "BUDGET",
      currentState: BUDGET_STATES.DRAFT,
      action: WORKFLOW_ACTIONS.SUBMIT,
      remarks: "",
      isLocked: false
    }),
    { action: "SUBMIT", nextState: "SUBMITTED" }
  );
  assert.throws(
    () =>
      validateTransition({
        workflowType: "BUDGET",
        currentState: BUDGET_STATES.DRAFT,
        action: WORKFLOW_ACTIONS.APPROVE,
        remarks: "",
        isLocked: false
      }),
    /not allowed/
  );
  assert.throws(
    () =>
      validateTransition({
        workflowType: "BUDGET",
        currentState: BUDGET_STATES.APPROVED,
        action: WORKFLOW_ACTIONS.LOCK,
        remarks: "",
        isLocked: false
      }),
    /Remarks are required/
  );
  assert.throws(
    () =>
      validateTransition({
        workflowType: "BUDGET",
        currentState: BUDGET_STATES.LOCKED,
        action: WORKFLOW_ACTIONS.SUBMIT,
        remarks: "",
        isLocked: true
      }),
    /already locked/
  );

  const memory = createMemoryDb();
  await setupPool(memory.pool);
  const created = await createWorkflowInstance(
    {
      workflowType: "BUDGET",
      entityType: "BUDGET_SUBMISSION",
      entityId: "101",
      budgetCycleId: 0,
      initialState: "DRAFT",
      idempotencyKey: "create-101"
    },
    { requestId: "req-create", actor: { displayName: "system" } }
  );
  assert.strictEqual(created.created, true);
  assert.strictEqual(created.workflow.currentState, "DRAFT");
  assert.strictEqual(memory.state.history.length, 1);
  assert.strictEqual(memory.state.committed, 1);
  assert.strictEqual(memory.state.released, 1);

  const submitted = await transitionWorkflow(
    created.workflow.id,
    {
      action: "SUBMIT",
      expectedVersion: 1,
      remarks: "Submitted for review",
      reasonCode: "",
      idempotencyKey: "submit-101",
      metadata: { password: "must-redact" }
    },
    { requestId: "req-submit", actor: { displayName: "system" } }
  );
  assert.strictEqual(submitted.previousState, "DRAFT");
  assert.strictEqual(submitted.currentState, "SUBMITTED");
  assert.strictEqual(submitted.version, 2);
  assert.strictEqual(memory.state.workflows[0].versionNumber, 2);
  assert.strictEqual(memory.state.history.length, 2);
  assert.strictEqual(memory.state.history[1].metadata.password, "[REDACTED]");

  const retry = await transitionWorkflow(
    created.workflow.id,
    {
      action: "SUBMIT",
      expectedVersion: 1,
      remarks: "Submitted for review",
      reasonCode: "",
      idempotencyKey: "submit-101",
      metadata: {}
    },
    { requestId: "req-submit-retry", actor: { displayName: "system" } }
  );
  assert.strictEqual(retry.idempotent, true);
  assert.strictEqual(memory.state.history.length, 2);

  await assert.rejects(
    () =>
      transitionWorkflow(
        created.workflow.id,
        {
          action: "START_REVIEW",
          expectedVersion: 1,
          remarks: "",
          reasonCode: "",
          idempotencyKey: "review-stale",
          metadata: {}
        },
        { requestId: "req-stale", actor: { displayName: "system" } }
      ),
    /version conflict/
  );

  const statuses = await attachBudgetWorkflowStatuses([{ id: 101 }, { id: 999 }]);
  assert.strictEqual(statuses[0].workflow_status, "SUBMITTED");
  assert.strictEqual(statuses[1].workflow_status, "NOT_STARTED");
  await closePool();

  const rollbackMemory = createMemoryDb({ failHistory: true });
  await setupPool(rollbackMemory.pool);
  await assert.rejects(
    () =>
      createWorkflowInstance(
        {
          workflowType: "BUDGET",
          entityType: "BUDGET_SUBMISSION",
          entityId: "202",
          budgetCycleId: 0,
          initialState: "DRAFT"
        },
        { requestId: "req-rollback", actor: { displayName: "system" } }
      ),
    /history insert failed/
  );
  assert.strictEqual(rollbackMemory.state.rolledBack, 1);
  assert.strictEqual(rollbackMemory.state.released, 1);
  await closePool();

  const previousAuditFlag = process.env.ENABLE_AUDIT_LOGS;
  process.env.ENABLE_AUDIT_LOGS = "true";
  const auditRollbackMemory = createMemoryDb({ failAudit: true });
  await setupPool(auditRollbackMemory.pool);
  await assert.rejects(
    () =>
      createWorkflowInstance(
        {
          workflowType: "BUDGET",
          entityType: "BUDGET_SUBMISSION",
          entityId: "203",
          budgetCycleId: 0,
          initialState: "DRAFT"
        },
        { requestId: "req-audit-rollback", actor: { displayName: "system" } }
      ),
    /audit insert failed/
  );
  assert.strictEqual(auditRollbackMemory.state.rolledBack, 1);
  assert.strictEqual(auditRollbackMemory.state.released, 1);
  process.env.ENABLE_AUDIT_LOGS = previousAuditFlag;
  await closePool();

  const apiMemory = createMemoryDb();
  await setupPool(apiMemory.pool);
  const server = await listen(app);
  try {
    const create = await requestJson(server, "POST", "/api/workflows", {
      workflowType: "BUDGET",
      entityType: "BUDGET_SUBMISSION",
      entityId: "301"
    });
    assert.strictEqual(create.statusCode, 201);
    const workflowId = create.body.data.workflow.id;
    const transition = await requestJson(server, "POST", `/api/workflows/${workflowId}/transitions`, {
      action: "SUBMIT",
      expectedVersion: 1,
      remarks: "Submitted",
      idempotencyKey: "api-submit"
    });
    assert.strictEqual(transition.statusCode, 200);
    assert.strictEqual(transition.body.data.currentState, "SUBMITTED");
    const history = await requestJson(server, "GET", `/api/workflows/${workflowId}/history`);
    assert.strictEqual(history.statusCode, 200);
    assert.strictEqual(history.body.data.length, 2);
    const invalid = await requestJson(server, "POST", `/api/workflows/${workflowId}/transitions`, {
      action: "LOCK",
      expectedVersion: 2,
      remarks: "Lock"
    });
    assert.strictEqual(invalid.statusCode, 409);
    assert.strictEqual(invalid.body.error.code, "INVALID_WORKFLOW_TRANSITION");
  } finally {
    await closeServer(server);
    await closePool();
  }

  const previousBasePath = process.env.APP_BASE_PATH;
  process.env.APP_BASE_PATH = "/budget-app";
  const basePathMemory = createMemoryDb();
  await setupPool(basePathMemory.pool);
  const basePathServer = await listen(app);
  try {
    const create = await requestJson(basePathServer, "POST", "/budget-app/api/workflows", {
      workflowType: "BUDGET",
      entityType: "BUDGET_SUBMISSION",
      entityId: "401"
    });
    assert.strictEqual(create.statusCode, 201);
    const workflowId = create.body.data.workflow.id;
    const read = await requestJson(basePathServer, "GET", `/budget-app/api/workflows/${workflowId}`);
    assert.strictEqual(read.statusCode, 200);
    assert.strictEqual(read.body.data.entityId, "401");
  } finally {
    if (previousBasePath === undefined) delete process.env.APP_BASE_PATH;
    else process.env.APP_BASE_PATH = previousBasePath;
    await closeServer(basePathServer);
    await closePool();
  }

  const migration = fs.readFileSync(path.join(__dirname, "..", "migrations", "009_workflow_foundation.sql"), "utf8");
  assert.ok(/CREATE TABLE IF NOT EXISTS budget_cycles/i.test(migration));
  assert.ok(/CREATE TABLE IF NOT EXISTS workflow_instances/i.test(migration));
  assert.ok(/CREATE TABLE IF NOT EXISTS workflow_history/i.test(migration));
  assert.ok(/UNIQUE KEY uk_workflow_identity/i.test(migration));
  assert.ok(/UNIQUE KEY uk_workflow_history_idempotency/i.test(migration));
  assert.ok(!/\bTRUNCATE\b/i.test(migration));
  assert.ok(!/\bDELETE\s+FROM\s+budget_submissions\b/i.test(migration));

  const appUi = fs.readFileSync(path.join(__dirname, "..", "app-ui.js"), "utf8");
  const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(appUi.includes("Workflow Status"));
  assert.ok(appUi.includes('data-action="workflow-history"'));
  assert.ok(appUi.includes('data-action="workflow-history-close"'));
  assert.ok(appJs.includes('apiUrl(`workflows/${workflowId}/history`)'));

  resetPoolForTests();
  console.log("Workflow foundation tests passed.");
}

run().catch(async (error) => {
  await closePool();
  console.error(error);
  process.exit(1);
});
