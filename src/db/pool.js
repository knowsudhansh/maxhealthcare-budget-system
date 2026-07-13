const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

let pool;
let poolConfigFingerprint = "";
let cachedCaPath = "";
let cachedCaContents = "";

function resolveCaPath(caPath) {
  const value = String(caPath || "").trim();
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(__dirname, "..", "..", value);
}

function loadSslCa(caPath, dependencies = {}) {
  const resolved = resolveCaPath(caPath);
  if (!resolved) {
    const error = new Error("DB_SSL_CA is required when DB_SSL=true.");
    error.code = "DB_SSL_CA_MISSING";
    throw error;
  }

  if (cachedCaPath === resolved && cachedCaContents) {
    return cachedCaContents;
  }

  const fileSystem = dependencies.fs || fs;
  try {
    cachedCaContents = fileSystem.readFileSync(resolved, "utf8");
    cachedCaPath = resolved;
    return cachedCaContents;
  } catch (cause) {
    const error = new Error("DB_SSL_CA file could not be read.");
    error.code = "DB_SSL_CA_UNREADABLE";
    error.cause = cause;
    throw error;
  }
}

function buildDbCredentials(config, secret) {
  const db = config.db;
  return {
    host: secret ? secret.host : db.host,
    port: secret ? secret.port : db.port,
    database: secret ? secret.database : db.database,
    user: secret ? secret.user : db.user,
    password: secret ? secret.password : db.password,
    ssl: db.ssl || Boolean(secret && secret.ssl),
    sslCaPath: db.sslCaPath || ""
  };
}

function buildPoolConfig(config, secret, dependencies = {}) {
  const credentials = buildDbCredentials(config, secret);
  const sslConfig = credentials.ssl
    ? {
        ca: loadSslCa(credentials.sslCaPath, dependencies),
        rejectUnauthorized: true
      }
    : undefined;
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
    ssl: sslConfig
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
  const poolConfig = buildPoolConfig(config, secret, dependencies);
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
  cachedCaPath = "";
  cachedCaContents = "";
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
  loadSslCa,
  query,
  resolveCaPath,
  resetPoolForTests
};
