const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const VALID_APP_ENVS = new Set(["development", "uat", "production"]);
const LOCALHOST_VALUES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const PROD_FORBIDDEN_SECRET_TERMS = ["uat", "test", "dev", "development", "local"];
const UAT_FORBIDDEN_SECRET_TERMS = ["production", "prod"];

function normalizeBasePath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/") return "";

  if (
    raw.includes("?") ||
    raw.includes("#") ||
    raw.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
  ) {
    throw new Error("APP_BASE_PATH is malformed.");
  }

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/g, "");
  const segments = withoutTrailingSlash.split("/").filter(Boolean);
  if (!segments.length) return "";
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("APP_BASE_PATH must not contain traversal segments.");
  }
  if (segments.some((segment) => !/^[A-Za-z0-9._~-]+$/.test(segment))) {
    throw new Error("APP_BASE_PATH contains unsupported characters.");
  }
  return `/${segments.join("/")}`;
}

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

function isBooleanString(value) {
  if (value === undefined || value === null || value === "") return true;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on", "0", "false", "no", "n", "off"].includes(normalized);
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

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function resolveEnvAlias(env, primaryName, legacyName, warnings, errors) {
  const primaryValue = env[primaryName];
  const legacyValue = env[legacyName];
  const primaryPresent = hasValue(primaryValue);
  const legacyPresent = hasValue(legacyValue);

  if (primaryPresent && legacyPresent && String(primaryValue) !== String(legacyValue)) {
    errors.push(`${primaryName}/${legacyName} conflict. Use ${primaryName}; remove the legacy ${legacyName} value.`);
    return primaryValue;
  }

  if (!primaryPresent && legacyPresent) {
    warnings.push(`${legacyName} is deprecated. Use ${primaryName}.`);
    return legacyValue;
  }

  return primaryValue;
}

function loadEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];
  const appEnv = normalizeAppEnv(env.APP_ENV);
  let appBasePath = "";

  try {
    appBasePath = normalizeBasePath(env.APP_BASE_PATH);
  } catch (error) {
    errors.push(error.message);
  }

  if (!appEnv) {
    errors.push("APP_ENV is required.");
  } else if (!VALID_APP_ENVS.has(appEnv)) {
    errors.push("APP_ENV must be development, uat, or production.");
  }

  const resolvedDbHost = resolveEnvAlias(env, "DB_HOST", "MYSQL_HOST", warnings, errors);
  const resolvedDbPort = resolveEnvAlias(env, "DB_PORT", "MYSQL_PORT", warnings, errors);
  const resolvedDbName = resolveEnvAlias(env, "DB_NAME", "MYSQL_DATABASE", warnings, errors);
  const resolvedDbUser = resolveEnvAlias(env, "DB_USER", "MYSQL_USER", warnings, errors);
  const resolvedDbPassword = resolveEnvAlias(env, "DB_PASSWORD", "MYSQL_PASSWORD", warnings, errors);

  if (!isBooleanString(env.DB_SSL)) {
    errors.push("DB_SSL must be true or false.");
  }

  const dbPort = parseInteger(resolvedDbPort, 3306, "DB_PORT", errors);
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
  const authSessionTtlMinutes = parseInteger(
    env.AUTH_SESSION_TTL_MINUTES,
    720,
    "AUTH_SESSION_TTL_MINUTES",
    errors
  );
  const authIdleTimeoutMinutes = parseInteger(
    env.AUTH_IDLE_TIMEOUT_MINUTES,
    60,
    "AUTH_IDLE_TIMEOUT_MINUTES",
    errors
  );
  const authMaxLoginAttempts = parseInteger(
    env.AUTH_MAX_LOGIN_ATTEMPTS,
    5,
    "AUTH_MAX_LOGIN_ATTEMPTS",
    errors
  );
  const authLockoutMinutes = parseInteger(
    env.AUTH_LOCKOUT_MINUTES,
    15,
    "AUTH_LOCKOUT_MINUTES",
    errors
  );
  const authPasswordMinLength = parseInteger(
    env.AUTH_PASSWORD_MIN_LENGTH,
    12,
    "AUTH_PASSWORD_MIN_LENGTH",
    errors
  );

  const config = {
    appEnv,
    port: parseInteger(env.PORT, 3000, "PORT", errors),
    appBasePath,
    frontendUrl: String(env.FRONTEND_URL || "").trim(),
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    awsRegion: String(env.AWS_REGION || "").trim(),
    logLevel: String(env.LOG_LEVEL || "info").trim(),
    warnings,
    auth: {
      sessionSecret: String(env.AUTH_SESSION_SECRET || "").trim(),
      sessionTtlMinutes: authSessionTtlMinutes,
      idleTimeoutMinutes: authIdleTimeoutMinutes,
      cookieName: String(env.AUTH_COOKIE_NAME || "max_it_opex_session").trim(),
      cookieSecure: parseBoolean(env.AUTH_COOKIE_SECURE, appEnv === "production" || appEnv === "uat"),
      cookieSameSite: String(env.AUTH_COOKIE_SAME_SITE || "Lax").trim(),
      maxLoginAttempts: authMaxLoginAttempts,
      lockoutMinutes: authLockoutMinutes,
      passwordMinLength: authPasswordMinLength,
      trustProxy: parseBoolean(env.AUTH_TRUST_PROXY, false),
      csrfEnabled: parseBoolean(env.CSRF_ENABLED, false)
    },
    db: {
      secretArn: String(env.DB_SECRET_ARN || "").trim(),
      host: String(resolvedDbHost || "").trim(),
      port: dbPort,
      database: String(resolvedDbName || "").trim(),
      user: String(resolvedDbUser || "").trim(),
      password: String(resolvedDbPassword || ""),
      ssl: parseBoolean(env.DB_SSL, false),
      sslCaPath: String(env.DB_SSL_CA || "").trim(),
      connectionLimit: dbConnectionLimit,
      connectTimeoutMs: dbConnectTimeoutMs
    },
    features: {
      enableExcelMirror: parseBoolean(env.ENABLE_EXCEL_MIRROR, true),
      enableGoogleSheetsSync: parseBoolean(env.ENABLE_GOOGLE_SHEETS_SYNC, true),
      workflowFoundationEnabled: parseBoolean(env.WORKFLOW_FOUNDATION_ENABLED, true),
      workflowActionsEnabled: parseBoolean(env.WORKFLOW_ACTIONS_ENABLED, true),
      workflowLockEnforcementEnabled: parseBoolean(env.WORKFLOW_LOCK_ENFORCEMENT_ENABLED, false),
      workflowApprovalQueueEnabled: parseBoolean(env.WORKFLOW_APPROVAL_QUEUE_ENABLED, true),
      latestEstimateEnabled: parseBoolean(env.LATEST_ESTIMATE_ENABLED, true),
      leWorkflowEnforcementEnabled: parseBoolean(env.LE_WORKFLOW_ENFORCEMENT_ENABLED, true),
      leAllowLegacyBudgetSource: parseBoolean(env.LE_ALLOW_LEGACY_BUDGET_SOURCE, false),
      leVarianceWarningPercent: Number(env.LE_VARIANCE_WARNING_PERCENT || 10),
      leVarianceMaterialPercent: Number(env.LE_VARIANCE_MATERIAL_PERCENT || 20),
      leVarianceWarningAmount: Number(env.LE_VARIANCE_WARNING_AMOUNT || 100000),
      leVarianceMaterialAmount: Number(env.LE_VARIANCE_MATERIAL_AMOUNT || 500000),
      nextFyBudgetEnabled: parseBoolean(env.NEXT_FY_BUDGET_ENABLED, true),
      nextFyWorkflowEnforcementEnabled: parseBoolean(env.NEXT_FY_WORKFLOW_ENFORCEMENT_ENABLED, true),
      nextFyAllowLegacySource: parseBoolean(env.NEXT_FY_ALLOW_LEGACY_SOURCE, false),
      nextFyAllowManualBaseline: parseBoolean(env.NEXT_FY_ALLOW_MANUAL_BASELINE, false),
      nextFyAllowGenerationReset: parseBoolean(env.NEXT_FY_ALLOW_GENERATION_RESET, false),
      nextFyDefaultGrowthPercent: Number(env.NEXT_FY_DEFAULT_GROWTH_PERCENT || 0),
      nextFyMaxGrowthPercent: Number(env.NEXT_FY_MAX_GROWTH_PERCENT || 100),
      nextFyMinGrowthPercent: Number(env.NEXT_FY_MIN_GROWTH_PERCENT || -100),
      nextFyMaxAbsoluteAmount: Number(env.NEXT_FY_MAX_ABSOLUTE_AMOUNT || 10000000000),
      nextFyMaxBulkLines: Number(env.NEXT_FY_MAX_BULK_LINES || 500),
      transferModuleEnabled: parseBoolean(env.TRANSFER_MODULE_ENABLED, true),
      transferPostingEnabled: parseBoolean(env.TRANSFER_POSTING_ENABLED, true),
      transferReversalEnabled: parseBoolean(env.TRANSFER_REVERSAL_ENABLED, true)
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

  if (!["Lax", "Strict", "None"].includes(config.auth.cookieSameSite)) {
    errors.push("AUTH_COOKIE_SAME_SITE must be Lax, Strict, or None.");
  }
  if (!/^[A-Za-z0-9_.-]{3,80}$/.test(config.auth.cookieName)) {
    errors.push("AUTH_COOKIE_NAME must contain only letters, numbers, underscore, dot, or hyphen.");
  }
  if (config.auth.cookieSameSite === "None" && !config.auth.cookieSecure) {
    errors.push("AUTH_COOKIE_SECURE=true is required when AUTH_COOKIE_SAME_SITE=None.");
  }
  if (config.auth.passwordMinLength < 12) {
    errors.push("AUTH_PASSWORD_MIN_LENGTH must be at least 12.");
  }
  if (config.appEnv === "uat" || config.appEnv === "production") {
    if (!config.auth.sessionSecret || config.auth.sessionSecret.length < 32) {
      errors.push("AUTH_SESSION_SECRET with at least 32 characters is required for UAT and Production.");
    }
  } else if (config.auth.sessionSecret && config.auth.sessionSecret.length < 32) {
    errors.push("AUTH_SESSION_SECRET must be at least 32 characters when set.");
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

  if (config.db.ssl && !config.db.sslCaPath) {
    errors.push("DB_SSL_CA is required when DB_SSL=true.");
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

  ["leVarianceWarningPercent", "leVarianceMaterialPercent", "leVarianceWarningAmount", "leVarianceMaterialAmount"].forEach((key) => {
    if (!Number.isFinite(config.features[key]) || config.features[key] < 0) {
      errors.push(`${key} must be a non-negative number.`);
    }
  });
  ["nextFyDefaultGrowthPercent", "nextFyMaxGrowthPercent", "nextFyMinGrowthPercent", "nextFyMaxAbsoluteAmount", "nextFyMaxBulkLines"].forEach((key) => {
    if (!Number.isFinite(config.features[key])) {
      errors.push(`${key} must be a valid number.`);
    }
  });
  if (config.features.nextFyMinGrowthPercent > config.features.nextFyMaxGrowthPercent) {
    errors.push("NEXT_FY_MIN_GROWTH_PERCENT must be less than or equal to NEXT_FY_MAX_GROWTH_PERCENT.");
  }
  if (config.features.nextFyMaxAbsoluteAmount <= 0) {
    errors.push("NEXT_FY_MAX_ABSOLUTE_AMOUNT must be greater than zero.");
  }
  if (!Number.isInteger(config.features.nextFyMaxBulkLines) || config.features.nextFyMaxBulkLines <= 0) {
    errors.push("NEXT_FY_MAX_BULK_LINES must be a positive integer.");
  }

  if (errors.length) {
    const error = new Error(`Environment validation failed: ${errors.join(" ")}`);
    error.code = errors.some((message) => /conflict/i.test(message)) ? "DB_CONFIG_CONFLICT" : "ENV_VALIDATION_ERROR";
    error.details = errors;
    throw error;
  }

  return config;
}

module.exports = {
  containsAnyTerm,
  isLocalhostHost,
  loadEnvironment,
  normalizeBasePath,
  normalizeAppEnv,
  isBooleanString,
  parseBoolean,
  parseOrigins,
  resolveEnvAlias
};
