-- Active: 1776163953746@@127.0.0.1@3306
-- Active: 1776163953746@@127.0.0.1@3306
USE maxhealthcare_it_opex;

-- Read latest submission rows
SELECT *
FROM budget_submissions
ORDER BY id DESC
LIMIT 50;

-- Insert one planner record
INSERT INTO planner_records (
  id,
  saved_at,
  coding,
  item,
  sub_category_mapped,
  category_it,
  sub_category,
  new_category,
  app_cate,
  cate3,
  cate4,
  owner1,
  owner,
  cost_center,
  cost_distribution,
  financial_year,
  location,
  loc_le,
  loc_fy_current,
  loc_fy_last,
  loc_percent,
  share_percent,
  cumulative_percent,
  new_amc,
  new_project,
  annualized,
  price_increase,
  new_unit,
  license_increase,
  rest,
  justification,
  loc_total
) VALUES (
  'row_demo_001',
  '2026-04-17 12:00:00',
  'ITOPEX170',
  'Porter Mangement',
  'AMC - IT Software',
  'Application',
  'Existing renewal',
  'Existing renewal',
  'Application AMC',
  'Existing renewal',
  'Annualized Impact',
  'Application',
  'Jatin',
  '30SUP020',
  'Fixed Cost',
  '2026-27',
  'BLK',
  300000.00,
  600000.00,
  500000.00,
  100.00,
  25.00,
  25.00,
  100000.00,
  150000.00,
  50000.00,
  75000.00,
  25000.00,
  15000.00,
  10000.00,
  'Sample insert for DB testing',
  425000.00
);

-- Update a planner record
UPDATE planner_records
SET loc_fy_current = 650000.00,
    loc_percent = 116.67,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'row_demo_001';

-- Save one allocation row
INSERT INTO allocation_records (
  id,
  coding,
  owner,
  mode,
  amount_input,
  percent_input,
  target_amount,
  saved_at
) VALUES (
  'alloc_demo_001',
  'ITOPEX170',
  'Jatin',
  'Distributed',
  150000.00,
  100.00,
  150000.00,
  '2026-04-17T12:00:00.000Z'
)
ON DUPLICATE KEY UPDATE
  mode = VALUES(mode),
  amount_input = VALUES(amount_input),
  percent_input = VALUES(percent_input),
  target_amount = VALUES(target_amount),
  saved_at = VALUES(saved_at),
  updated_at = CURRENT_TIMESTAMP;

-- Delete demo rows
DELETE FROM allocation_records WHERE id = 'alloc_demo_001';
DELETE FROM planner_records WHERE id = 'row_demo_001';
