const SENSITIVE_KEYS = new Set([
  "password",
  "db_password",
  "dbsecretarn",
  "secret",
  "secretarn",
  "db_secret_arn",
  "authorization",
  "cookie"
]);

function sanitizeAuditData(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditData(item));
  }
  if (!value || typeof value !== "object") return value;
  const next = {};
  Object.keys(value).forEach((key) => {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    next[key] = SENSITIVE_KEYS.has(normalized) ? "[REDACTED]" : sanitizeAuditData(value[key]);
  });
  return next;
}

async function writeAuditEvent(connection, event, options = {}) {
  if (!options.enabled) return { skipped: true, reason: "disabled" };
  const payload = {
    entityType: String(event.entityType || ""),
    entityId: String(event.entityId || ""),
    action: String(event.action || ""),
    oldData: sanitizeAuditData(event.oldData || null),
    newData: sanitizeAuditData(event.newData || null),
    changedBy: String(event.changedBy || "legacy-user"),
    requestId: String(event.requestId || "")
  };

  await connection.execute(
    `
      INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        old_data,
        new_data,
        changed_by,
        request_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.entityType,
      payload.entityId,
      payload.action,
      JSON.stringify(payload.oldData),
      JSON.stringify(payload.newData),
      payload.changedBy,
      payload.requestId
    ]
  );

  return { skipped: false };
}

module.exports = {
  sanitizeAuditData,
  writeAuditEvent
};
