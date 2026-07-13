-- TiDB Cloud Starter temporary demo schema.
-- Idempotent and non-destructive: no table removal, data clearing, or data overwrite.

CREATE TABLE IF NOT EXISTS budget_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submitted_at VARCHAR(64) NULL,
  coding VARCHAR(50) NULL,
  item VARCHAR(255) NULL,
  sub_category_mapped VARCHAR(255) NULL,
  category_it VARCHAR(255) NULL,
  sub_category VARCHAR(255) NULL,
  new_category VARCHAR(255) NULL,
  app_cate VARCHAR(255) NULL,
  cate3 VARCHAR(255) NULL,
  cate4 VARCHAR(255) NULL,
  owner1 VARCHAR(100) NULL,
  owner VARCHAR(100) NULL,
  cost_center_department VARCHAR(100) NULL,
  financial_year VARCHAR(20) NULL,
  location VARCHAR(100) NULL,
  cost_distribution VARCHAR(40) NOT NULL DEFAULT 'Fixed Cost',
  loc_fy_current DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  loc_fy_last DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  loc_le DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_amc DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_project DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  annualized DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  price_increase DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_unit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  license_increase DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  rest DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  justification TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_budget_submissions_year_location (financial_year, location),
  KEY idx_budget_submissions_coding (coding),
  KEY idx_budget_submissions_owner (owner),
  KEY idx_budget_submissions_category (category_it)
);

CREATE TABLE IF NOT EXISTS allocation_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  coding VARCHAR(50) NOT NULL,
  item VARCHAR(255) NULL,
  owner VARCHAR(100) NOT NULL,
  financial_year VARCHAR(20) NOT NULL,
  mode VARCHAR(40) NOT NULL DEFAULT 'Distributed',
  amount_input DECIMAL(18,2) NULL,
  percent_input DECIMAL(10,2) NULL,
  target_amount DECIMAL(18,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_records_key (coding, owner, financial_year),
  KEY idx_allocation_records_owner (owner),
  KEY idx_allocation_records_year (financial_year)
);

CREATE TABLE IF NOT EXISTS allocation_location_map (
  location VARCHAR(120) NOT NULL,
  percent DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (location)
);

CREATE TABLE IF NOT EXISTS allocation_matrix (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  financial_year VARCHAR(20) NOT NULL,
  coding VARCHAR(50) NOT NULL,
  item VARCHAR(255) NULL,
  owner VARCHAR(100) NOT NULL,
  total_budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  cost_distribution VARCHAR(40) NOT NULL DEFAULT 'Distributed',
  location_amounts_json JSON NULL,
  location_percents_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_matrix (financial_year, coding, owner, cost_distribution),
  KEY idx_allocation_matrix_year (financial_year),
  KEY idx_allocation_matrix_coding (coding),
  KEY idx_allocation_matrix_owner (owner)
);

INSERT INTO allocation_location_map (location, percent)
VALUES
  ('Saket', 13.8700),
  ('Max Smart', 5.6700),
  ('Gurgaon', 3.5900),
  ('Lajpat Nagar', 0.3600),
  ('Panchsheel', 1.4200),
  ('Patparganj', 8.0300),
  ('Vaishali', 7.5600),
  ('Noida', 0.4700),
  ('Shalimar Bagh', 6.4400),
  ('Mohali', 4.5300),
  ('Dehradun', 3.5000),
  ('Bathinda', 1.9100),
  ('HO', 3.4000),
  ('BLK', 11.2800),
  ('Nanawati', 6.1900),
  ('Nagpur', 4.7200),
  ('Lucknow', 5.2000),
  ('Dwarka', 5.2000),
  ('Jaypee Noida', 6.6700)
ON DUPLICATE KEY UPDATE
  percent = VALUES(percent);

-- If an existing database has older tables, verify columns with:
-- SHOW COLUMNS FROM budget_submissions;
-- SHOW COLUMNS FROM allocation_records;
-- SHOW COLUMNS FROM allocation_matrix;
-- Do not drop or recreate tables that already contain data.
