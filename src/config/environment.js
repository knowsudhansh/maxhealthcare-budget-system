const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const VALID_APP_ENVS = new Set(["development", "uat", "production"]);
const LOCALHOST_VALUES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const PROD_FORBIDDEN_SECRET_TERMS = ["uat", "test", "dev", "development", "local"];
const UAT_FORBIDDEN_SECRET_TERMS = ["production", "prod"];

function normalizeAppEnv(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "dev" || normalized === "local") return "development";
  if (normalized === "prod") return "production";
  return normalized;
}

function parseInteger(value, fallback, name, errors) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive integer.`);
    return fallback;
  }
  return parsed;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalhostHost(value) {
  return LOCALHOST_VALUES.has(String(value || "").trim().toLowerCase());
}

function containsAnyTerm(value, terms) {
  const normalized = String(value || "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function requireValue(value, name, errors) {
  if (value === undefined || value === null || String(value).trim() === "") {
    errors.push(`${name} is required.`);
  }
}

function loadEnvironment(env = process.env) {
  const errors = [];
  const appEnv = normalizeAppEnv(env.APP_ENV);

  if (!appEnv) {
    errors.push("APP_ENV is required.");
  } else if (!VALID_APP_ENVS.has(appEnv)) {
    errors.push("APP_ENV must be development, uat, or production.");
  }

  const dbPort = parseInteger(env.DB_PORT || env.MYSQL_PORT, 3306, "DB_PORT", errors);
  const dbConnectionLimit = parseInteger(
    env.DB_CONNECTION_LIMIT,
    10,
    "DB_CONNECTION_LIMIT",
    errors
  );
  const dbConnectTimeoutMs = parseInteger(
    env.DB_CONNECT_TIMEOUT_MS,
    10000,
    "DB_CONNECT_TIMEOUT_MS",
    errors
  );

  const config = {
    appEnv,
    port: parseInteger(env.PORT, 3000, "PORT", errors),
    frontendUrl: String(env.FRONTEND_URL || "").trim(),
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    awsRegion: String(env.AWS_REGION || "").trim(),
    logLevel: String(env.LOG_LEVEL || "info").trim(),
    db: {
      secretArn: String(env.DB_SECRET_ARN || "").trim(),
      host: String(env.DB_HOST || env.MYSQL_HOST || "").trim(),
      port: dbPort,
      database: String(env.DB_NAME || env.MYSQL_DATABASE || "").trim(),
      user: String(env.DB_USER || env.MYSQL_USER || "").trim(),
      password: String(env.DB_PASSWORD || env.MYSQL_PASSWORD || ""),
      ssl: parseBoolean(env.DB_SSL, false),
      connectionLimit: dbConnectionLimit,
      connectTimeoutMs: dbConnectTimeoutMs
    },
    features: {
      enableExcelMirror: parseBoolean(env.ENABLE_EXCEL_MIRROR, true),
      enableGoogleSheetsSync: parseBoolean(env.ENABLE_GOOGLE_SHEETS_SYNC, true)
    }
  };

  const hasSecret = Boolean(config.db.secretArn);
  const hasDirectDbConfig = Boolean(
    config.db.host && config.db.database && config.db.user && config.db.password
  );

  if (config.appEnv === "development" && !config.allowedOrigins.length) {
    config.allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001"
    ];
  }

  if (hasSecret && !config.awsRegion) {
    errors.push("AWS_REGION is required when DB_SECRET_ARN is set.");
  }

  if (!hasSecret && !hasDirectDbConfig) {
    requireValue(config.db.host, "DB_HOST", errors);
    requireValue(config.db.database, "DB_NAME", errors);
    requireValue(config.db.user, "DB_USER", errors);
    requireValue(config.db.password, "DB_PASSWORD", errors);
  }

  if (config.appEnv === "uat" || config.appEnv === "production") {
    if (!config.db.ssl) {
      errors.push("DB_SSL=true is required for UAT and Production.");
    }

    if (!hasSecret && isLocalhostHost(config.db.host)) {
      errors.push("UAT and Production must not use a localhost DB host.");
    }

    if (!config.allowedOrigins.length || config.allowedOrigins.includes("*")) {
      errors.push("UAT and Production must define ALLOWED_ORIGINS without wildcard '*'.");
    }
  }

  if (config.appEnv === "production") {
    if (config.db.secretArn && containsAnyTerm(config.db.secretArn, PROD_FORBIDDEN_SECRET_TERMS)) {
      errors.push("Production DB_SECRET_ARN must not look like a UAT/test/development/local secret.");
    }
  }

  if (config.appEnv === "uat") {
    if (config.db.secretArn && containsAnyTerm(config.db.secretArn, UAT_FORBIDDEN_SECRET_TERMS)) {
      errors.push("UAT DB_SECRET_ARN must not look like a Production secret.");
    }
  }

  if (errors.length) {
    const error = new Error(`Environment validation failed: ${errors.join(" ")}`);
    error.code = "ENV_VALIDATION_ERROR";
    error.details = errors;
    throw error;
  }

  return config;
}

module.exports = {
  containsAnyTerm,
  isLocalhostHost,
  loadEnvironment,
  normalizeAppEnv,
  parseBoolean,
  parseOrigins
};
