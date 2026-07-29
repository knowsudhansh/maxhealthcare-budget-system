const assert = require("assert");
const {
  assertMigrationIsSafe,
  parseArgs,
  splitSqlStatements
} = require("../scripts/apply-migration");

function run() {
  assert.deepStrictEqual(parseArgs(["--file=013_authentication_rbac_foundation.sql"]), {
    file: "013_authentication_rbac_foundation.sql"
  });
  assert.strictEqual(splitSqlStatements("CREATE TABLE a (id INT); -- comment\nCREATE TABLE b (id INT);").length, 2);
  assert.doesNotThrow(() => assertMigrationIsSafe("CREATE TABLE IF NOT EXISTS users (id INT);", "safe.sql"));
  assert.throws(
    () => assertMigrationIsSafe("DROP TABLE users;", "unsafe.sql"),
    /forbidden operation/
  );
  assert.throws(
    () => assertMigrationIsSafe("ALTER TABLE budget_submissions DROP COLUMN coding;", "unsafe.sql"),
    /forbidden operation/
  );
  assert.doesNotThrow(() => assertMigrationIsSafe(`
    CREATE TABLE IF NOT EXISTS users (id INT);
    -- Rollback guidance:
    -- DROP TABLE users;
  `, "safe-rollback-comment.sql"));
  console.log("Migration runner tests passed.");
}

run();
