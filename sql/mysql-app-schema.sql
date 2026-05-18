USE maxhealthcare_it_opex;

CREATE TABLE IF NOT EXISTS budget_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submitted_at VARCHAR(64) NOT NULL,
  coding VARCHAR(50) NULL,
  item VARCHAR(255) NULL,
  category_it VARCHAR(255) NULL,
  sub_category VARCHAR(255) NULL,
  new_category VARCHAR(255) NULL,
  app_cate VARCHAR(255) NULL,
  cate3 VARCHAR(255) NULL,
  cate4 VARCHAR(255) NULL,
  owner1 VARCHAR(100) NULL,
  owner VARCHAR(100) NULL,
  cost_center_department VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_budget_submissions_coding (coding),
  KEY idx_budget_submissions_owner (owner),
  KEY idx_budget_submissions_category (category_it)
);

CREATE TABLE IF NOT EXISTS planner_records (
  id VARCHAR(80) NOT NULL,
  saved_at VARCHAR(64) NOT NULL,
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
  cost_center VARCHAR(100) NULL,
  cost_distribution VARCHAR(40) NOT NULL DEFAULT 'Fixed Cost',
  financial_year VARCHAR(20) NULL,
  location VARCHAR(100) NULL,
  loc_le DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  loc_fy_current DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  loc_fy_last DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  loc_percent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  share_percent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cumulative_percent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  new_amc DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_project DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  annualized DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  price_increase DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  new_unit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  license_increase DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  rest DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  justification TEXT NULL,
  loc_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_planner_records_year_location (financial_year, location),
  KEY idx_planner_records_coding (coding),
  KEY idx_planner_records_owner (owner)
);

CREATE TABLE IF NOT EXISTS allocation_records (
  id VARCHAR(80) NOT NULL,
  coding VARCHAR(50) NOT NULL,
  owner VARCHAR(100) NOT NULL,
  mode VARCHAR(40) NOT NULL DEFAULT 'Distributed',
  amount_input DECIMAL(18,2) NULL,
  percent_input DECIMAL(10,2) NULL,
  target_amount DECIMAL(18,2) NULL,
  saved_at VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_coding_owner (coding, owner),
  KEY idx_allocation_owner (owner)
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
