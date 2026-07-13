-- Phase 3.2 proposal only. Do not apply to Production without approval.
-- Audit persistence foundation for future authenticated writes.

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  action VARCHAR(40) NOT NULL,
  old_data JSON NULL,
  new_data JSON NULL,
  changed_by VARCHAR(120) NOT NULL DEFAULT 'legacy-user',
  request_id VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_request (request_id),
  KEY idx_audit_logs_created_at (created_at)
);
