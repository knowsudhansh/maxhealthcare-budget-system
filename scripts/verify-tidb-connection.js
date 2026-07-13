const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { closePool, getPool, initializePool } = require("../src/db/pool");

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

async function main() {
  const config = loadEnvironment(process.env);
  const secret = await loadDbSecret(config);
  await initializePool(config, secret);
  const pool = getPool();

  try {
    const [databaseRows] = await pool.query("SELECT DATABASE() AS database_name");
    const databaseName = databaseRows && databaseRows[0] ? databaseRows[0].database_name : "";
    await pool.query("SELECT VERSION() AS version");
    const [sslRows] = await pool.query("SHOW STATUS LIKE 'Ssl_cipher'");
    const sslCipher = sslRows && sslRows[0] ? sslRows[0].Value : "";

    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
      const [tableRows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
      if (!Array.isArray(tableRows) || !tableRows.length) {
        const error = new Error(`Required table missing: ${tableName}`);
        error.code = "SCHEMA_MISSING_TABLE";
        throw error;
      }

      const [columnRows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
      const existingColumns = new Set((columnRows || []).map((column) => String(column.Field || "").toLowerCase()));
      const missing = requiredColumns.filter((column) => !existingColumns.has(column.toLowerCase()));
      if (missing.length) {
        const error = new Error(`Required columns missing in ${tableName}`);
        error.code = "SCHEMA_MISSING_COLUMNS";
        throw error;
      }
    }

    const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM budget_submissions");
    const plannerCount = countRows && countRows[0] ? Number(countRows[0].total || 0) : 0;

    console.log("TiDB connection: OK");
    console.log(`TLS verification: ${config.db.ssl && sslCipher ? "OK" : config.db.ssl ? "FAILED" : "NOT_ENABLED"}`);
    console.log(`Database: ${databaseName}`);
    console.log("Required schema: OK");
    console.log(`Planner records: ${plannerCount}`);

    if (config.db.ssl && !sslCipher) {
      process.exitCode = 1;
    }
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    const safeCodes = new Set(["SCHEMA_MISSING_TABLE", "SCHEMA_MISSING_COLUMNS"]);
    const suffix = safeCodes.has(error.code) ? ` - ${error.message}` : "";
    console.error(`TiDB verification failed: ${error.code || "ERROR"}${suffix}`);
    await closePool();
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_SCHEMA
};
