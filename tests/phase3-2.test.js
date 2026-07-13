const assert = require("assert");
const express = require("express");
const http = require("http");

const { AppError, ERROR_CODES, validationError } = require("../src/errors/app-error");
const { requestIdMiddleware } = require("../src/middleware/request-id");
const { errorHandler } = require("../src/middleware/error-handler");
const { withTransaction } = require("../src/db/transaction");
const {
  closePool,
  initializePool,
  resetPoolForTests
} = require("../src/db/pool");
const {
  parseFinancialNumber,
  parsePositiveInteger,
  validateFinancialYear,
  validatePercentage
} = require("../src/validation/common");
const {
  normalizeAmountMap,
  validateAllocatedTotal
} = require("../src/validation/allocation");
const { sanitizeAuditData, writeAuditEvent } = require("../src/audit/audit-service");
const {
  assertVersionedUpdateAffected,
  buildVersionedWhere
} = require("../src/db/optimistic-locking");
const { app } = require("../server");

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

function requestJson(server, method, path, body, headers = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers
        }
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        });
      }
    );
    req.on("error", reject);
    req.end(payload);
  });
}

async function setupPool(fakePool) {
  resetPoolForTests();
  await initializePool(baseConfig(), null, {
    mysql: {
      createPool: () => fakePool
    }
  });
}

async function run() {
  let committed = false;
  let rolledBack = false;
  let released = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      committed = true;
    },
    rollback: async () => {
      rolledBack = true;
    },
    release: () => {
      released = true;
    }
  };
  await setupPool({
    query: async () => [[]],
    getConnection: async () => connection,
    end: async () => {}
  });
  const txResult = await withTransaction(async () => "ok");
  assert.strictEqual(txResult, "ok");
  assert.strictEqual(committed, true);
  assert.strictEqual(released, true);
  assert.strictEqual(rolledBack, false);
  await closePool();

  committed = false;
  rolledBack = false;
  released = false;
  const originalError = new Error("child failed");
  await setupPool({
    query: async () => [[]],
    getConnection: async () => connection,
    end: async () => {}
  });
  await assert.rejects(
    () =>
      withTransaction(async () => {
        throw originalError;
      }),
    (error) => error === originalError
  );
  assert.strictEqual(committed, false);
  assert.strictEqual(rolledBack, true);
  assert.strictEqual(released, true);
  await closePool();

  assert.strictEqual(parseFinancialNumber(0, "amount"), 0);
  assert.strictEqual(parseFinancialNumber("1,00,000", "amount", { allowFormatted: true }), 100000);
  assert.throws(() => parseFinancialNumber("1,00,000", "amount"), /valid number/);
  assert.throws(() => validateFinancialYear("2026"), /YYYY-YY/);
  assert.throws(() => parsePositiveInteger("0", "id"), /positive integer/);
  assert.throws(() => validatePercentage(101, "percent"), /between 0 and 100/);
  assert.deepStrictEqual(normalizeAmountMap({ Saket: "1,00,000", BLK: 0 }), {
    Saket: 100000,
    BLK: 0
  });
  assert.throws(() => validateAllocatedTotal(90, 100), /Allocated amount/);

  const idApp = express();
  idApp.use(requestIdMiddleware);
  idApp.get("/id", (req, res) => res.json({ requestId: req.requestId }));
  const idServer = await listen(idApp);
  try {
    const generated = await requestJson(idServer, "GET", "/id");
    assert.ok(generated.headers["x-request-id"]);
    const inbound = await requestJson(idServer, "GET", "/id", undefined, {
      "X-Request-ID": "safe-id-123"
    });
    assert.strictEqual(inbound.headers["x-request-id"], "safe-id-123");
    const unsafe = await requestJson(idServer, "GET", "/id", undefined, {
      "X-Request-ID": "../bad".repeat(30)
    });
    assert.notStrictEqual(unsafe.headers["x-request-id"], "../bad".repeat(30));
  } finally {
    await closeServer(idServer);
  }

  const errorApp = express();
  errorApp.use(requestIdMiddleware);
  errorApp.get("/validation", () => {
    throw validationError("Invalid input.");
  });
  errorApp.get("/not-found", () => {
    throw new AppError({
      statusCode: 404,
      publicCode: ERROR_CODES.RECORD_NOT_FOUND,
      publicMessage: "Record not found."
    });
  });
  errorApp.get("/duplicate", () => {
    const error = new Error("duplicate");
    error.code = "ER_DUP_ENTRY";
    throw error;
  });
  errorApp.get("/conflict", () => {
    throw new AppError({
      statusCode: 409,
      publicCode: ERROR_CODES.RECORD_CONFLICT,
      publicMessage: "Conflict."
    });
  });
  errorApp.get("/database", () => {
    const error = new Error("db");
    error.code = "ECONNREFUSED";
    throw error;
  });
  errorApp.get("/internal", () => {
    throw new Error("stack should not leak");
  });
  errorApp.use(errorHandler);
  const errorServer = await listen(errorApp);
  try {
    process.env.APP_ENV = "production";
    const validation = await requestJson(errorServer, "GET", "/validation");
    assert.strictEqual(validation.statusCode, 400);
    assert.strictEqual(validation.body.error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(validation.body.error.requestId);

    assert.strictEqual((await requestJson(errorServer, "GET", "/not-found")).statusCode, 404);
    assert.strictEqual((await requestJson(errorServer, "GET", "/duplicate")).statusCode, 409);
    assert.strictEqual((await requestJson(errorServer, "GET", "/conflict")).statusCode, 409);
    assert.strictEqual((await requestJson(errorServer, "GET", "/database")).statusCode, 503);
    const internal = await requestJson(errorServer, "GET", "/internal");
    assert.strictEqual(internal.statusCode, 500);
    assert.strictEqual(JSON.stringify(internal.body).includes("stack should not leak"), false);
  } finally {
    await closeServer(errorServer);
  }

  const sanitized = sanitizeAuditData({
    user: "legacy-user",
    password: "secret",
    nested: { DB_SECRET_ARN: "arn" }
  });
  assert.strictEqual(sanitized.password, "[REDACTED]");
  assert.strictEqual(sanitized.nested.DB_SECRET_ARN, "[REDACTED]");
  const auditQueries = [];
  await writeAuditEvent(
    {
      execute: async (sql, params) => {
        auditQueries.push({ sql, params });
      }
    },
    {
      entityType: "allocation_matrix",
      entityId: "1",
      action: "UPDATE",
      newData: sanitized,
      requestId: "req-1"
    },
    { enabled: true }
  );
  assert.strictEqual(auditQueries.length, 1);
  assert.strictEqual(auditQueries[0].params[5], "legacy-user");
  assert.deepStrictEqual(await writeAuditEvent({}, {}, { enabled: false }), {
    skipped: true,
    reason: "disabled"
  });

  assert.strictEqual(buildVersionedWhere(), "id = ? AND record_version = ?");
  assert.doesNotThrow(() => assertVersionedUpdateAffected(1));
  assert.throws(() => assertVersionedUpdateAffected(0), /changed by another user/);

  let insertedAmounts = null;
  let rollbackCalled = false;
  let commitCalled = false;
  const routeConnection = {
    beginTransaction: async () => {},
    commit: async () => {
      commitCalled = true;
    },
    rollback: async () => {
      rollbackCalled = true;
    },
    release: () => {},
    query: async () => [
      [
        { location: "Saket", percent: 50 },
        { location: "BLK", percent: 50 }
      ]
    ],
    execute: async (sql, params) => {
      if (sql.includes("INSERT INTO allocation_matrix")) {
        insertedAmounts = JSON.parse(params[6]);
      }
      if (sql.includes("SELECT * FROM allocation_matrix")) {
        return [[{ id: 7, total_budget: 150000, location_amounts_json: JSON.stringify(insertedAmounts) }]];
      }
      return [{ affectedRows: 1 }];
    }
  };
  await setupPool({
    query: async () => [[]],
    getConnection: async () => routeConnection,
    end: async () => {}
  });
  const routeServer = await listen(app);
  try {
    const response = await requestJson(routeServer, "POST", "/api/allocation-matrix", {
      financialYear: "2026-27",
      coding: "ITOPEX007",
      owner: "Amit",
      totalBudget: "1,50,000",
      costDistribution: "Distributed",
      locationAmounts: {
        Saket: "1,00,000",
        BLK: "50,000"
      },
      locationPercents: {
        Saket: 50,
        BLK: 50
      }
    });
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(insertedAmounts.Saket, 100000);
    assert.strictEqual(insertedAmounts.BLK, 50000);
    assert.strictEqual(commitCalled, true);
    assert.strictEqual(rollbackCalled, false);
  } finally {
    await closeServer(routeServer);
    await closePool();
  }

  rollbackCalled = false;
  await setupPool({
    query: async () => [[]],
    getConnection: async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {
        rollbackCalled = true;
      },
      release: () => {},
      query: async () => [[{ location: "Saket", percent: 100 }]],
      execute: async (sql) => {
        if (sql.includes("INSERT INTO allocation_matrix")) {
          throw new Error("child write failed");
        }
        return [[]];
      }
    }),
    end: async () => {}
  });
  const failureServer = await listen(app);
  try {
    const response = await requestJson(failureServer, "POST", "/api/allocation-matrix", {
      financialYear: "2026-27",
      coding: "ITOPEX007",
      owner: "Amit",
      totalBudget: 100,
      locationAmounts: { Saket: 100 },
      locationPercents: { Saket: 100 }
    });
    assert.strictEqual(response.statusCode, 500);
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(rollbackCalled, true);
  } finally {
    await closeServer(failureServer);
    await closePool();
  }

  console.log("Phase 3.2 transaction, validation, error, request-id, audit, and allocation tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
