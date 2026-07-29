const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { closePool, getPool, initializePool } = require("../src/db/pool");
const { serializeDatabaseError } = require("../src/db/error-diagnostics");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const HISTORY_TABLE = "schema_migrations";

function parseArgs(argv = process.argv.slice(2)) {
  return argv.reduce((acc, arg) => {
    const match = String(arg).match(/^--([^=]+)=(.*)$/);
    if (match) acc[match[1]] = match[2];
    else if (arg === "--allow-production") acc.allowProduction = true;
    return acc;
  }, {});
}

function stripRollbackSection(sql) {
  return String(sql || "").split(/--\s*Rollback guidance/i)[0];
}

function assertMigrationIsSafe(sql, migrationName) {
  const executable = stripRollbackSection(sql);
  const forbidden = [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bALTER\s+TABLE\s+budget_submissions\b/i,
    /\bALTER\s+TABLE\s+allocation_records\b/i,
    /\bALTER\s+TABLE\s+allocation_matrix\b/i
  ];
  const matched = forbidden.find((pattern) => pattern.test(executable));
  if (matched) {
    const error = new Error(`Migration ${migrationName} contains a forbidden operation.`);
    error.code = "MIGRATION_UNSAFE";
    throw error;
  }
}

function splitSqlStatements(sql) {
  const executable = stripRollbackSection(sql);
  const statements = [];
  let current = "";
  let quote = "";
  for (let index = 0; index < executable.length; index += 1) {
    const char = executable[index];
    const next = executable[index + 1];
    if (!quote && char === "-" && next === "-") {
      while (index < executable.length && executable[index] !== "\n") index += 1;
      continue;
    }
    if (!quote && char === "/" && next === "*") {
      index += 2;
      while (index < executable.length && !(executable[index] === "*" && executable[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    if ((char === "'" || char === '"' || char === "`") && executable[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (!quote && char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }
  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

async function ensureHistoryTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      migration_name VARCHAR(180) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_schema_migrations_name (migration_name)
    )
  `);
}

async function isApplied(pool, migrationName) {
  const [rows] = await pool.execute(
    `SELECT migration_name, checksum, applied_at FROM ${HISTORY_TABLE} WHERE migration_name = ? LIMIT 1`,
    [migrationName]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function applyMigration(migrationName, options = {}) {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationName);
  if (!fs.existsSync(migrationPath)) {
    const error = new Error(`Migration file not found: ${migrationName}`);
    error.code = "MIGRATION_NOT_FOUND";
    throw error;
  }

  const config = loadEnvironment(process.env);
  if (config.appEnv === "production" && !options.allowProduction) {
    const error = new Error("Refusing to apply migrations when APP_ENV=production.");
    error.code = "MIGRATION_PRODUCTION_BLOCKED";
    throw error;
  }
  if (!["development", "uat"].includes(config.appEnv)) {
    const error = new Error("Migration target APP_ENV must be development or uat.");
    error.code = "MIGRATION_ENV_BLOCKED";
    throw error;
  }

  const secret = await loadDbSecret(config);
  await initializePool(config, secret);
  const pool = getPool();
  const sql = fs.readFileSync(migrationPath, "utf8");
  assertMigrationIsSafe(sql, migrationName);
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  await ensureHistoryTable(pool);

  const previous = await isApplied(pool, migrationName);
  if (previous) {
    return {
      applied: false,
      migrationName,
      appEnv: config.appEnv,
      dbName: config.db.database,
      history: previous
    };
  }

  const statements = splitSqlStatements(sql);
  for (const statement of statements) {
    await pool.query(statement);
  }
  await pool.execute(
    `INSERT INTO ${HISTORY_TABLE} (migration_name, checksum, applied_at) VALUES (?, ?, NOW())`,
    [migrationName, checksum]
  );
  return {
    applied: true,
    migrationName,
    appEnv: config.appEnv,
    dbName: config.db.database,
    statementCount: statements.length
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const migrationName = args.file || args.migration;
  if (!migrationName) {
    throw Object.assign(new Error("Use --file=<migration-file.sql>."), { code: "MIGRATION_FILE_REQUIRED" });
  }
  const result = await applyMigration(migrationName, { allowProduction: Boolean(args.allowProduction) });
  console.log(JSON.stringify({
    migration: result.migrationName,
    applied: result.applied,
    appEnv: result.appEnv,
    database: result.dbName,
    statementCount: result.statementCount || 0,
    recorded: true
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Migration failed.");
      console.error(JSON.stringify(serializeDatabaseError(error, { stage: "apply-migration" }), null, 2));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}

module.exports = {
  HISTORY_TABLE,
  applyMigration,
  assertMigrationIsSafe,
  parseArgs,
  splitSqlStatements
};
