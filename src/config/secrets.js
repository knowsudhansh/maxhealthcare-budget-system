const {
  GetSecretValueCommand,
  SecretsManagerClient
} = require("@aws-sdk/client-secrets-manager");

const secretCache = new Map();

function parseSecretString(secretString) {
  try {
    return JSON.parse(secretString);
  } catch (error) {
    const wrapped = new Error("Database secret must be valid JSON.");
    wrapped.code = "DB_SECRET_INVALID";
    throw wrapped;
  }
}

function normalizeDbSecret(secret) {
  const normalized = {
    host: String(secret.host || "").trim(),
    port: secret.port === undefined || secret.port === "" ? 3306 : Number(secret.port),
    database: String(secret.dbname || secret.database || "").trim(),
    user: String(secret.username || secret.user || "").trim(),
    password: String(secret.password || ""),
    ssl: secret.ssl
  };

  const errors = [];
  if (!normalized.host) errors.push("host is required.");
  if (!Number.isInteger(normalized.port) || normalized.port <= 0) {
    errors.push("port must be a positive integer.");
  }
  if (!normalized.database) errors.push("dbname/database is required.");
  if (!normalized.user) errors.push("username/user is required.");
  if (!normalized.password) errors.push("password is required.");

  if (errors.length) {
    const error = new Error(`Database secret validation failed: ${errors.join(" ")}`);
    error.code = "DB_SECRET_INVALID";
    error.details = errors;
    throw error;
  }

  return normalized;
}

async function loadDbSecret(config, dependencies = {}) {
  const secretArn = config && config.db ? config.db.secretArn : "";
  if (!secretArn) return null;

  if (secretCache.has(secretArn)) {
    return secretCache.get(secretArn);
  }

  const Client = dependencies.SecretsManagerClient || SecretsManagerClient;
  const Command = dependencies.GetSecretValueCommand || GetSecretValueCommand;
  const client =
    dependencies.client ||
    new Client({
      region: config.awsRegion
    });

  const response = await client.send(
    new Command({
      SecretId: secretArn
    })
  );

  if (!response || !response.SecretString) {
    const error = new Error("Database secret did not contain a SecretString.");
    error.code = "DB_SECRET_INVALID";
    throw error;
  }

  const normalized = normalizeDbSecret(parseSecretString(response.SecretString));
  secretCache.set(secretArn, normalized);
  return normalized;
}

function clearSecretCacheForTests() {
  secretCache.clear();
}

module.exports = {
  clearSecretCacheForTests,
  loadDbSecret,
  normalizeDbSecret,
  parseSecretString
};
