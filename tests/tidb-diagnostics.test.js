const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const { loadEnvironment } = require("../src/config/environment");
const { loadSslCa, resetPoolForTests } = require("../src/db/pool");
const {
  redactSensitiveText,
  serializeDatabaseError
} = require("../src/db/error-diagnostics");
const {
  isConnectionOnly,
  verifyRequiredSchema,
  verifyTlsSession
} = require("../scripts/verify-tidb-connection");

const root = path.join(__dirname, "..");

async function testSafeSerialization() {
  const error = new Error("ER_UNKNOWN_ERROR: safe TiDB message");
  error.name = "Error";
  error.code = "ER_UNKNOWN_ERROR";
  error.errno = 1105;
  error.sqlState = "HY000";
  error.sqlMessage = "TiDB rejected the connection without password output.";
  error.verificationStage = "initialize-pool";
  const diagnostic = serializeDatabaseError(error);
  assert.deepStrictEqual(diagnostic, {
    stage: "initialize-pool",
    name: "Error",
    code: "ER_UNKNOWN_ERROR",
    errno: 1105,
    sqlState: "HY000",
    sqlMessage: "TiDB rejected the connection without password output.",
    message: "ER_UNKNOWN_ERROR: safe TiDB message"
  });

  assert.strictEqual(redactSensitiveText("password=my-secret"), "[REDACTED]");
  assert.strictEqual(redactSensitiveText("using password: YES"), "using password: YES");
  assert.strictEqual(redactSensitiveText("mysql://user:secret@example/db"), "[REDACTED]");
  assert.strictEqual(redactSensitiveText("ordinary TiDB message"), "ordinary TiDB message");
}

function testConfigurationValidation() {
  assert.throws(
    () => loadEnvironment({ APP_ENV: "development", DB_PORT: "bad", DB_HOST: "localhost", DB_NAME: "budget", DB_USER: "user", DB_PASSWORD: "secret" }),
    /DB_PORT/
  );
  assert.throws(
    () => loadEnvironment({ APP_ENV: "development", DB_SSL: "maybe", DB_HOST: "localhost", DB_NAME: "budget", DB_USER: "user", DB_PASSWORD: "secret" }),
    /DB_SSL/
  );
  assert.throws(
    () => loadEnvironment({ APP_ENV: "development", DB_HOST: "db-a", MYSQL_HOST: "db-b", DB_NAME: "budget", DB_USER: "user", DB_PASSWORD: "secret" }),
    /conflict/
  );
  const legacy = loadEnvironment({
    APP_ENV: "development",
    MYSQL_HOST: "localhost",
    MYSQL_PORT: "3306",
    MYSQL_DATABASE: "budget",
    MYSQL_USER: "user",
    MYSQL_PASSWORD: "secret",
    DB_SSL: "false"
  });
  assert.strictEqual(legacy.db.host, "localhost");
  assert.ok(legacy.warnings.some((warning) => warning.includes("MYSQL_HOST")));
}

function testCaValidation() {
  assert.throws(
    () => loadEnvironment({ APP_ENV: "development", DB_HOST: "localhost", DB_NAME: "budget", DB_USER: "user", DB_PASSWORD: "secret", DB_SSL: "true" }),
    /DB_SSL_CA/
  );
  assert.throws(
    () => loadSslCa("./certs/does-not-exist-for-test.pem"),
    (error) => error.code === "DB_SSL_CA_UNREADABLE" && !error.message.includes("does-not-exist")
  );
}

async function testCliModesAndSchemaErrors() {
  assert.strictEqual(isConnectionOnly(["--connection-only"]), true);
  assert.strictEqual(isConnectionOnly([]), false);

  await assert.rejects(
    () => verifyRequiredSchema({
      query: async () => [[]]
    }),
    (error) => {
      const diagnostic = serializeDatabaseError(error, { stage: "validate-schema" });
      assert.strictEqual(diagnostic.code, "SCHEMA_MISSING_TABLE");
      assert.strictEqual(error.tableName, "budget_submissions");
      return true;
    }
  );

  await assert.rejects(
    () => verifyRequiredSchema({
      query: async (sql) => {
        if (/SHOW TABLES/i.test(sql)) return [[{ table: "budget_submissions" }]];
        return [[{ Field: "id" }]];
      }
    }),
    (error) => {
      const diagnostic = serializeDatabaseError(error, { stage: "validate-schema" });
      assert.strictEqual(diagnostic.code, "SCHEMA_MISSING_COLUMNS");
      assert.ok(error.missingColumns.includes("submitted_at"));
      return true;
    }
  );
}

async function testTlsVerification() {
  assert.strictEqual(await verifyTlsSession({ query: async () => [[{ Value: "TLS_AES_256_GCM_SHA384" }]] }, true), "OK");
  assert.strictEqual(await verifyTlsSession({ query: async () => [[{ Value: "" }]] }, true), "FAILED");
  assert.strictEqual(await verifyTlsSession({ query: async () => { throw new Error("unsupported"); } }, true), "UNCONFIRMED");
  assert.strictEqual(await verifyTlsSession({ query: async () => [] }, false), "NOT_ENABLED");
}

function testServerStartupSafeLogging() {
  const result = spawnSync(process.execPath, ["server.js"], {
    cwd: root,
    encoding: "utf8",
    env: Object.assign({}, process.env, {
      APP_ENV: "development",
      PORT: "3999",
      DB_HOST: "localhost",
      DB_PORT: "3306",
      DB_NAME: "budget",
      DB_USER: "user",
      DB_PASSWORD: "super-secret-test-password",
      DB_SSL: "true",
      DB_SSL_CA: ""
    }),
    timeout: 10000
  });
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Server startup failed/);
  assert.match(result.stderr, /DB_SSL_CA/);
  assert.ok(!result.stderr.includes("super-secret-test-password"));
}

async function run() {
  resetPoolForTests();
  await testSafeSerialization();
  testConfigurationValidation();
  testCaValidation();
  await testCliModesAndSchemaErrors();
  await testTlsVerification();
  testServerStartupSafeLogging();
  console.log("TiDB diagnostics tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
