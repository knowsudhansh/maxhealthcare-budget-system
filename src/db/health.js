const { getPool } = require("./pool");

async function checkDatabaseReady(poolOverride) {
  const pool = poolOverride || getPool();
  if (!pool) return false;

  try {
    await pool.query("SELECT 1");
    return true;
  } catch (_) {
    return false;
  }
}

async function getSafeDatabaseHealth(poolOverride) {
  const connected = await checkDatabaseReady(poolOverride);
  return {
    configured: Boolean(poolOverride || getPool()),
    connected
  };
}

module.exports = {
  checkDatabaseReady,
  getSafeDatabaseHealth
};
