const { getPool } = require("./pool");

async function withTransaction(callback, context = {}) {
  const pool = getPool();
  if (!pool) {
    const error = new Error("Database pool is not initialized.");
    error.code = "DATABASE_UNAVAILABLE";
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          requestId: context.requestId || "",
          message: "Transaction rollback failed.",
          errorCode: rollbackError && rollbackError.code ? rollbackError.code : "ROLLBACK_FAILED"
        })
      );
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  withTransaction
};
