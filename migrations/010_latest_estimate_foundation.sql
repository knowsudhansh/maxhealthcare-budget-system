-- Phase 4D Latest Estimate foundation.
-- Additive and non-destructive. Do not run against Production/UAT/TiDB demo without approval.

CREATE TABLE IF NOT EXISTS latest_estimate_matrices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  matrix_code VARCHAR(80) NOT NULL,
  matrix_name VARCHAR(180) NOT NULL,
  budget_cycle_id BIGINT UNSIGNED NULL,
  financial_year VARCHAR(20) NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  workflow_instance_id BIGINT UNSIGNED NULL,
  source_budget_version VARCHAR(80) NULL,
  created_by VARCHAR(120) NOT NULL DEFAULT 'system',
  updated_by VARCHAR(120) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_le_matrix_code (matrix_code),
  KEY idx_le_matrix_year_status (financial_year, status),
  KEY idx_le_matrix_workflow (workflow_instance_id),
  KEY idx_le_matrix_cycle (budget_cycle_id)
);

CREATE TABLE IF NOT EXISTS latest_estimate_cells (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  matrix_id BIGINT UNSIGNED NOT NULL,
  budget_entity_id VARCHAR(80) NOT NULL,
  coding VARCHAR(50) NOT NULL,
  location VARCHAR(120) NOT NULL,
  financial_year VARCHAR(20) NOT NULL,
  budget_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  latest_estimate_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  variance_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  variance_percentage DECIMAL(12,4) NULL,
  variance_severity VARCHAR(40) NOT NULL DEFAULT 'ON_BUDGET',
  remarks TEXT NULL,
  cell_version INT NOT NULL DEFAULT 1,
  created_by VARCHAR(120) NOT NULL DEFAULT 'system',
  updated_by VARCHAR(120) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_le_cell_identity (matrix_id, budget_entity_id, coding, location, financial_year),
  KEY idx_le_cell_matrix (matrix_id),
  KEY idx_le_cell_coding_location (coding, location),
  KEY idx_le_cell_severity (matrix_id, variance_severity),
  KEY idx_le_cell_changed (matrix_id, cell_version)
);

CREATE TABLE IF NOT EXISTS variance_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  matrix_id BIGINT UNSIGNED NOT NULL,
  cell_id BIGINT UNSIGNED NULL,
  budget_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  latest_estimate_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  variance_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  variance_percentage DECIMAL(12,4) NULL,
  previous_severity VARCHAR(40) NULL,
  current_severity VARCHAR(40) NOT NULL,
  threshold_rule VARCHAR(120) NULL,
  remarks TEXT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_variance_logs_matrix (matrix_id, created_at),
  KEY idx_variance_logs_cell (cell_id)
);

CREATE TABLE IF NOT EXISTS latest_estimate_save_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  matrix_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  expected_matrix_version INT NOT NULL,
  saved_cell_count INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'COMMITTED',
  request_id VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_le_save_batch_idempotency (matrix_id, idempotency_key),
  KEY idx_le_save_batch_matrix (matrix_id, created_at)
);

-- Rollback guidance:
-- Only after confirming no application depends on Phase 4D data:
-- DROP TABLE latest_estimate_save_batches;
-- DROP TABLE variance_logs;
-- DROP TABLE latest_estimate_cells;
-- DROP TABLE latest_estimate_matrices;
