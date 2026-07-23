-- Phase 4E: Next FY Budget foundation.
-- Additive and non-destructive. Do not run automatically at application startup.
-- This migration creates standalone Next FY budget, line, assumption, batch, and adjustment-history tables.
-- It does not modify budget_submissions, latest_estimate_matrices, or latest_estimate_cells.

CREATE TABLE IF NOT EXISTS next_fy_budgets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  budget_code VARCHAR(100) NOT NULL,
  budget_name VARCHAR(255) NOT NULL,
  budget_cycle_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  source_strategy VARCHAR(40) NOT NULL,
  source_entity_id VARCHAR(80) NULL,
  source_version INT NOT NULL DEFAULT 1,
  source_financial_year VARCHAR(20) NOT NULL,
  target_financial_year VARCHAR(20) NOT NULL,
  workflow_instance_id BIGINT UNSIGNED NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'GENERATED',
  version_number INT NOT NULL DEFAULT 1,
  total_source_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_generated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_manual_adjustment DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_final_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  generation_remarks TEXT NULL,
  generated_at TIMESTAMP NULL,
  created_by VARCHAR(120) NULL,
  updated_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_next_fy_budget_code (budget_code),
  KEY idx_next_fy_budget_cycle (budget_cycle_id),
  KEY idx_next_fy_target_year (target_financial_year),
  KEY idx_next_fy_source (source_strategy, source_entity_id),
  KEY idx_next_fy_workflow (workflow_instance_id),
  KEY idx_next_fy_status (status)
);

CREATE TABLE IF NOT EXISTS next_fy_budget_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  next_fy_budget_id BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_entity_id VARCHAR(80) NULL,
  source_line_id VARCHAR(80) NULL,
  source_version INT NOT NULL DEFAULT 1,
  source_financial_year VARCHAR(20) NOT NULL,
  target_financial_year VARCHAR(20) NOT NULL,
  coding VARCHAR(50) NOT NULL,
  item VARCHAR(255) NULL,
  description TEXT NULL,
  category VARCHAR(255) NULL,
  location VARCHAR(120) NOT NULL,
  owner VARCHAR(120) NULL,
  owner1 VARCHAR(120) NULL,
  source_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  growth_percentage DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  growth_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  fixed_adjustment_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  generated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  manual_adjustment_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  final_budget_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  adjustment_reason TEXT NULL,
  assumption_rule_id BIGINT UNSIGNED NULL,
  line_version INT NOT NULL DEFAULT 1,
  validation_status VARCHAR(40) NOT NULL DEFAULT 'VALID',
  created_by VARCHAR(120) NULL,
  updated_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_next_fy_line_identity (next_fy_budget_id, source_type, source_line_id, coding, location),
  KEY idx_next_fy_line_budget (next_fy_budget_id),
  KEY idx_next_fy_line_coding (coding),
  KEY idx_next_fy_line_location (location),
  KEY idx_next_fy_line_owner (owner),
  KEY idx_next_fy_line_owner1 (owner1),
  KEY idx_next_fy_line_category (category),
  KEY idx_next_fy_line_validation (validation_status)
);

CREATE TABLE IF NOT EXISTS planning_assumption_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  next_fy_budget_id BIGINT UNSIGNED NOT NULL,
  rule_name VARCHAR(180) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  location VARCHAR(120) NULL,
  coding VARCHAR(50) NULL,
  category VARCHAR(255) NULL,
  owner VARCHAR(120) NULL,
  growth_percentage DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  fixed_adjustment_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  minimum_amount DECIMAL(18,2) NULL,
  maximum_amount DECIMAL(18,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  remarks TEXT NULL,
  created_by VARCHAR(120) NULL,
  updated_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assumption_budget (next_fy_budget_id),
  KEY idx_assumption_type_priority (rule_type, priority),
  KEY idx_assumption_coding_location (coding, location),
  KEY idx_assumption_category_location (category, location),
  KEY idx_assumption_owner (owner),
  KEY idx_assumption_active (is_active)
);

CREATE TABLE IF NOT EXISTS next_fy_generation_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  next_fy_budget_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  expected_version INT NOT NULL,
  source_record_count INT NOT NULL DEFAULT 0,
  generated_line_count INT NOT NULL DEFAULT 0,
  total_source_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_generated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL,
  request_id VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_next_fy_generation_idempotency (next_fy_budget_id, idempotency_key),
  KEY idx_next_fy_generation_budget (next_fy_budget_id),
  KEY idx_next_fy_generation_request (request_id)
);

CREATE TABLE IF NOT EXISTS next_fy_adjustment_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  next_fy_budget_id BIGINT UNSIGNED NOT NULL,
  line_id BIGINT UNSIGNED NOT NULL,
  previous_manual_adjustment DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_manual_adjustment DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  previous_final_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_final_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  difference_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  adjustment_type VARCHAR(50) NOT NULL,
  adjustment_reason TEXT NULL,
  request_id VARCHAR(80) NULL,
  performed_by VARCHAR(120) NULL,
  performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_next_fy_adjustment_budget (next_fy_budget_id),
  KEY idx_next_fy_adjustment_line (line_id),
  KEY idx_next_fy_adjustment_time (performed_at)
);

-- Rollback guidance for isolated non-production environments only:
-- DROP TABLE next_fy_adjustment_history;
-- DROP TABLE next_fy_generation_batches;
-- DROP TABLE planning_assumption_rules;
-- DROP TABLE next_fy_budget_lines;
-- DROP TABLE next_fy_budgets;
