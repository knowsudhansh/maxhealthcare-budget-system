const mysql = require("mysql2/promise");

let pool;
let poolConfigFingerprint = "";

function buildDbCredentials(config, secret) {
  const db = config.db;
  return {
    host: secret ? secret.host : db.host,
    port: secret ? secret.port : db.port,
    database: secret ? secret.database : db.database,
    user: secret ? secret.user : db.user,
    password: secret ? secret.password : db.password,
    ssl: db.ssl || Boolean(secret && secret.ssl)
  };
}

function buildPoolConfig(config, secret) {
  const credentials = buildDbCredentials(config, secret);
  return {
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    connectTimeout: config.db.connectTimeoutMs,
    ssl: credentials.ssl ? { rejectUnauthorized: true } : undefined
  };
}

function fingerprintPoolConfig(config) {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    connectionLimit: config.connectionLimit,
    connectTimeout: config.connectTimeout,
    ssl: Boolean(config.ssl)
  });
}

async function initializePool(config, secret = null, dependencies = {}) {
  if (pool) return pool;

  const mysqlClient = dependencies.mysql || mysql;
  const poolConfig = buildPoolConfig(config, secret);
  const nextPool = mysqlClient.createPool(poolConfig);

  try {
    await nextPool.query("SELECT 1");
  } catch (error) {
    if (nextPool && typeof nextPool.end === "function") {
      try {
        await nextPool.end();
      } catch (_) {
        // Startup failure is reported by the original connectivity error.
      }
    }
    error.code = error.code || "DATABASE_UNAVAILABLE";
    throw error;
  }

  pool = nextPool;
  poolConfigFingerprint = fingerprintPoolConfig(poolConfig);
  return pool;
}

function getPool() {
  return pool || null;
}

function hasPool() {
  return Boolean(pool);
}

async function query(sql, params = []) {
  if (!pool) {
    const error = new Error("Database pool is not initialized.");
    error.code = "DATABASE_UNAVAILABLE";
    throw error;
  }
  return pool.query(sql, params);
}

async function execute(sql, params = []) {
  if (!pool) {
    const error = new Error("Database pool is not initialized.");
    error.code = "DATABASE_UNAVAILABLE";
    throw error;
  }
  return pool.execute(sql, params);
}

async function closePool() {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  poolConfigFingerprint = "";
  await activePool.end();
}

function getPoolConfigFingerprint() {
  return poolConfigFingerprint;
}

function resetPoolForTests() {
  pool = null;
  poolConfigFingerprint = "";
}

module.exports = {
  buildDbCredentials,
  buildPoolConfig,
  closePool,
  execute,
  getPool,
  getPoolConfigFingerprint,
  hasPool,
  initializePool,
  query,
  resetPoolForTests
};
