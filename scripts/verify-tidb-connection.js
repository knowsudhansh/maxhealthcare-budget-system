const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { closePool, getPool, initializePool } = require("../src/db/pool");
const {
  attachVerificationStage,
  serializeDatabaseError
} = require("../src/db/error-diagnostics");

const REQUIRED_SCHEMA = {
  budget_submissions: [
    "id",
    "submitted_at",
    "coding",
    "item",
    "sub_category_mapped",
    "category_it",
    "sub_category",
    "new_category",
    "app_cate",
    "cate3",
    "cate4",
    "owner1",
    "owner",
    "cost_center_department",
    "financial_year",
    "location",
    "cost_distribution",
    "loc_fy_current",
    "loc_fy_last",
    "loc_le",
    "new_amc",
    "new_project",
    "annualized",
    "price_increase",
    "new_unit",
    "license_increase",
    "rest",
    "justification"
  ],
  allocation_records: [
    "id",
    "coding",
    "item",
    "owner",
    "financial_year",
    "mode",
    "amount_input",
    "percent_input",
    "target_amount",
    "created_at",
    "updated_at"
  ],
  allocation_location_map: ["location", "percent", "updated_at"],
  allocation_matrix: [
    "id",
    "financial_year",
    "coding",
    "item",
    "owner",
    "total_budget",
    "cost_distribution",
    "location_amounts_json",
    "location_percents_json",
    "created_at",
    "updated_at"
  ]
};

function isConnectionOnly(argv = process.argv.slice(2)) {
  return argv.includes("--connection-only");
}

function schemaError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function logEnvironmentWarnings(config) {
  (config.warnings || []).forEach((warning) => {
    console.warn(`Configuration warning: ${warning}`);
  });
}

async function verifyTlsSession(pool, sslEnabled) {
  if (!sslEnabled) return "NOT_ENABLED";
  try {
    const [sslRows] = await pool.query("SHOW STATUS LIKE 'Ssl_cipher'");
    const sslCipher = sslRows && sslRows[0] ? sslRows[0].Value : "";
    return sslCipher ? "OK" : "FAILED";
  } catch (_error) {
    return "UNCONFIRMED";
  }
}

async function verifyRequiredSchema(pool) {
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    const [tableRows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
    if (!Array.isArray(tableRows) || !tableRows.length) {
      throw schemaError("SCHEMA_MISSING_TABLE", `Required table missing: ${tableName}`, { tableName });
    }

    const [columnRows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const existingColumns = new Set((columnRows || []).map((column) => String(column.Field || "").toLowerCase()));
    const missingColumns = requiredColumns.filter((column) => !existingColumns.has(column.toLowerCase()));
    if (missingColumns.length) {
      throw schemaError("SCHEMA_MISSING_COLUMNS", `Required columns missing in ${tableName}`, {
        tableName,
        missingColumns
      });
    }
  }
}

async function runVerification(options = {}) {
  let stage = "load-environment";
  try {
    const config = loadEnvironment(process.env);
    logEnvironmentWarnings(config);

    stage = "load-db-secret";
    const secret = await loadDbSecret(config);

    stage = "initialize-pool";
    await initializePool(config, secret);

    stage = "get-pool";
    const pool = getPool();
    if (!pool) {
      const error = new Error("Database pool is not initialized.");
      error.code = "DATABASE_UNAVAILABLE";
      throw error;
    }

    stage = "select-database";
    const [databaseRows] = await pool.query("SELECT DATABASE() AS database_name");
    const databaseName = databaseRows && databaseRows[0] ? databaseRows[0].database_name : "";

    stage = "select-version";
    await pool.query("SELECT VERSION() AS version");

    stage = "check-tls";
    const tlsStatus = await verifyTlsSession(pool, config.db.ssl);

    let plannerCount = null;
    if (!options.connectionOnly) {
      stage = "validate-schema";
      await verifyRequiredSchema(pool);

      stage = "count-planner-records";
      const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM budget_submissions");
      plannerCount = countRows && countRows[0] ? Number(countRows[0].total || 0) : 0;
    }

    console.log("TiDB connection: OK");
    console.log(`TLS verification: ${tlsStatus}`);
    console.log(`Database: ${databaseName}`);
    if (options.connectionOnly) {
      console.log("Required schema: SKIPPED");
    } else {
      console.log("Required schema: OK");
      console.log(`Planner records: ${plannerCount}`);
    }

    if (config.db.ssl && tlsStatus === "FAILED") {
      process.exitCode = 1;
    }

    stage = "close-pool";
    await closePool();
  } catch (error) {
    attachVerificationStage(error, stage);
    throw error;
  }
}

async function main(argv = process.argv.slice(2)) {
  return runVerification({ connectionOnly: isConnectionOnly(argv) });
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error("TiDB verification failed.");
    const diagnostic = serializeDatabaseError(error);
    if (error && error.code === "SCHEMA_MISSING_COLUMNS" && Array.isArray(error.missingColumns)) {
      diagnostic.missingColumns = error.missingColumns;
      diagnostic.tableName = error.tableName;
    }
    if (error && error.code === "SCHEMA_MISSING_TABLE" && error.tableName) {
      diagnostic.tableName = error.tableName;
    }
    console.error(JSON.stringify(diagnostic, null, 2));
    if (process.env.TIDB_VERIFY_DEBUG_STACK === "true" && error && error.stack) {
      console.error(error.stack);
    }
    await closePool();
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_SCHEMA,
  isConnectionOnly,
  main,
  runVerification,
  verifyRequiredSchema,
  verifyTlsSession
};
