-- Phase 4B workflow foundation.
-- Additive and non-destructive. Do not run against UAT/Production without approval.

CREATE TABLE IF NOT EXISTS budget_cycles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cycle_code VARCHAR(80) NOT NULL,
  cycle_name VARCHAR(180) NOT NULL,
  financial_year VARCHAR(20) NOT NULL,
  cycle_type VARCHAR(40) NOT NULL DEFAULT 'BUDGET',
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_budget_cycles_code (cycle_code),
  KEY idx_budget_cycles_year (financial_year),
  KEY idx_budget_cycles_status (status)
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workflow_type VARCHAR(40) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  budget_cycle_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  current_state VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  version_number INT NOT NULL DEFAULT 1,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(120) NOT NULL DEFAULT 'system',
  updated_by VARCHAR(120) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_workflow_identity (workflow_type, entity_type, entity_id, budget_cycle_id),
  KEY idx_workflow_entity (entity_type, entity_id),
  KEY idx_workflow_type_state (workflow_type, current_state),
  KEY idx_workflow_cycle (budget_cycle_id),
  KEY idx_workflow_updated_at (updated_at)
);

CREATE TABLE IF NOT EXISTS workflow_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workflow_instance_id BIGINT UNSIGNED NOT NULL,
  from_state VARCHAR(40) NULL,
  to_state VARCHAR(40) NOT NULL,
  action VARCHAR(80) NOT NULL,
  remarks TEXT NULL,
  reason_code VARCHAR(80) NULL,
  metadata_json JSON NULL,
  idempotency_key VARCHAR(120) NULL,
  request_id VARCHAR(80) NULL,
  performed_by VARCHAR(120) NOT NULL DEFAULT 'system',
  performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_workflow_history_idempotency (workflow_instance_id, idempotency_key),
  KEY idx_workflow_history_instance (workflow_instance_id),
  KEY idx_workflow_history_performed_at (performed_at),
  KEY idx_workflow_history_action (action)
);

-- Rollback guidance:
-- DROP TABLE workflow_history;
-- DROP TABLE workflow_instances;
-- DROP TABLE budget_cycles;
-- Only execute rollback after confirming no workflow data must be retained.
