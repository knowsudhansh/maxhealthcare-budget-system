-- Phase 4F: Enterprise Budget Transfer foundation.
-- Additive and non-destructive. No approved Budget, LE, or Next FY rows are overwritten.

CREATE TABLE IF NOT EXISTS budget_transfer_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_number VARCHAR(100) NOT NULL,
  transfer_type VARCHAR(60) NOT NULL,
  reason TEXT NOT NULL,
  priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
  requested_by VARCHAR(120) NULL,
  requested_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  workflow_instance_id BIGINT UNSIGNED NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  version_number INT NOT NULL DEFAULT 1,
  financial_year VARCHAR(20) NOT NULL,
  remarks TEXT NULL,
  total_transfer_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  posted_at TIMESTAMP NULL,
  reversed_at TIMESTAMP NULL,
  created_by VARCHAR(120) NULL,
  updated_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_budget_transfer_number (transfer_number),
  KEY idx_transfer_status (status),
  KEY idx_transfer_type (transfer_type),
  KEY idx_transfer_financial_year (financial_year),
  KEY idx_transfer_workflow (workflow_instance_id),
  KEY idx_transfer_requested_date (requested_date)
);

CREATE TABLE IF NOT EXISTS budget_transfer_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_request_id BIGINT UNSIGNED NOT NULL,
  source_budget_line_id BIGINT UNSIGNED NOT NULL,
  destination_budget_line_id BIGINT UNSIGNED NOT NULL,
  source_coding VARCHAR(50) NULL,
  destination_coding VARCHAR(50) NULL,
  source_department VARCHAR(120) NULL,
  destination_department VARCHAR(120) NULL,
  source_location VARCHAR(120) NULL,
  destination_location VARCHAR(120) NULL,
  source_owner VARCHAR(120) NULL,
  destination_owner VARCHAR(120) NULL,
  source_category VARCHAR(255) NULL,
  destination_category VARCHAR(255) NULL,
  transfer_amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  transfer_type VARCHAR(60) NOT NULL,
  remarks TEXT NULL,
  line_version INT NOT NULL DEFAULT 1,
  created_by VARCHAR(120) NULL,
  updated_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transfer_line_request (transfer_request_id),
  KEY idx_transfer_line_source (source_budget_line_id),
  KEY idx_transfer_line_destination (destination_budget_line_id),
  KEY idx_transfer_line_source_coding (source_coding),
  KEY idx_transfer_line_destination_coding (destination_coding),
  KEY idx_transfer_line_locations (source_location, destination_location)
);

CREATE TABLE IF NOT EXISTS budget_transfer_postings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_request_id BIGINT UNSIGNED NOT NULL,
  transfer_line_id BIGINT UNSIGNED NOT NULL,
  posting_type VARCHAR(30) NOT NULL,
  budget_line_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  financial_year VARCHAR(20) NOT NULL,
  posting_status VARCHAR(40) NOT NULL DEFAULT 'POSTED',
  reversal_of_posting_id BIGINT UNSIGNED NULL,
  request_id VARCHAR(80) NULL,
  posted_by VARCHAR(120) NULL,
  posted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transfer_posting_request (transfer_request_id),
  KEY idx_transfer_posting_line (transfer_line_id),
  KEY idx_transfer_posting_budget_line (budget_line_id),
  KEY idx_transfer_posting_type (posting_type),
  KEY idx_transfer_posting_reversal (reversal_of_posting_id)
);

CREATE TABLE IF NOT EXISTS budget_transfer_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_request_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NULL,
  action VARCHAR(60) NOT NULL,
  remarks TEXT NULL,
  metadata_json JSON NULL,
  request_id VARCHAR(80) NULL,
  performed_by VARCHAR(120) NULL,
  performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transfer_history_request (transfer_request_id),
  KEY idx_transfer_history_time (performed_at),
  KEY idx_transfer_history_action (action)
);

CREATE TABLE IF NOT EXISTS working_budget_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  budget_line_id BIGINT UNSIGNED NOT NULL,
  financial_year VARCHAR(20) NOT NULL,
  original_budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  incoming_transfers DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  outgoing_transfers DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  working_budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  available_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  transferred_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  remaining_budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  last_transfer_request_id BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_working_budget_line_year (budget_line_id, financial_year),
  KEY idx_working_budget_year (financial_year),
  KEY idx_working_budget_available (available_balance)
);

-- Rollback guidance for isolated non-production environments only:
-- DROP TABLE working_budget_balances;
-- DROP TABLE budget_transfer_history;
-- DROP TABLE budget_transfer_postings;
-- DROP TABLE budget_transfer_lines;
-- DROP TABLE budget_transfer_requests;
