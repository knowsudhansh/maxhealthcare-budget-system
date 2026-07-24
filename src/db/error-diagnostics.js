const SENSITIVE_PATTERN = /(BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY|BEGIN\s+CERTIFICATE|mysql2?:\/\/|authorization:\s*\S+|bearer\s+\S+|(?:password|passwd|pwd|secret|token)=\S+)/i;

function redactSensitiveText(value) {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (!text) return text;
  if (SENSITIVE_PATTERN.test(text)) return "[REDACTED]";
  return text
    .replace(/(password|passwd|pwd|token|secret)=([^;&\s]+)/gi, "$1=[REDACTED]")
    .replace(/mysql2?:\/\/[^@\s]+@/gi, "mysql://[REDACTED]@");
}

function safeErrorField(error, field) {
  if (!error || error[field] === undefined || error[field] === null) return undefined;
  return redactSensitiveText(error[field]);
}

function serializeDatabaseError(error, options = {}) {
  const diagnostic = {
    stage: options.stage || (error && error.verificationStage) || (error && error.startupStage) || "",
    name: safeErrorField(error, "name") || "Error",
    code: safeErrorField(error, "code") || "ERROR",
    errno: error && error.errno !== undefined ? error.errno : undefined,
    sqlState: safeErrorField(error, "sqlState"),
    sqlMessage: safeErrorField(error, "sqlMessage"),
    message: safeErrorField(error, "message")
  };

  Object.keys(diagnostic).forEach((key) => {
    if (diagnostic[key] === undefined || diagnostic[key] === "") {
      delete diagnostic[key];
    }
  });
  return diagnostic;
}

function attachVerificationStage(error, stage) {
  if (error && typeof error === "object") {
    error.verificationStage = stage;
  }
  return error;
}

module.exports = {
  attachVerificationStage,
  redactSensitiveText,
  serializeDatabaseError
};
