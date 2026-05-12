CREATE DATABASE maxhealthcare_opex;
\c maxhealthcare_opex;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE opex_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  coding TEXT NOT NULL,
  item TEXT,
  sub_category_mapped TEXT,
  category_it TEXT,
  sub_category TEXT,
  new_category TEXT,
  app_cate TEXT,
  cate_3 TEXT,
  cate_4 TEXT,
  owner1 TEXT,
  owner TEXT,
  cost_center TEXT,

  cost_distribution TEXT NOT NULL DEFAULT 'Fixed Cost'
    CHECK (cost_distribution IN ('Fixed Cost', 'Distribution')),

  financial_year VARCHAR(7),
  location TEXT,

  loc_le NUMERIC(14,2) NOT NULL DEFAULT 0,
  loc_fy_current NUMERIC(14,2) NOT NULL DEFAULT 0,
  loc_fy_last NUMERIC(14,2) NOT NULL DEFAULT 0,
  loc_percent NUMERIC(10,2) NOT NULL DEFAULT 0,

  new_amc NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_project NUMERIC(14,2) NOT NULL DEFAULT 0,
  annualized NUMERIC(14,2) NOT NULL DEFAULT 0,
  price_increase NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  license_increase NUMERIC(14,2) NOT NULL DEFAULT 0,
  rest NUMERIC(14,2) NOT NULL DEFAULT 0,

  loc_total NUMERIC(14,2) GENERATED ALWAYS AS (
    COALESCE(new_amc,0) + COALESCE(new_project,0) + COALESCE(annualized,0) +
    COALESCE(price_increase,0) + COALESCE(new_unit,0) + COALESCE(license_increase,0) +
    COALESCE(rest,0)
  ) STORED,

  share_percent NUMERIC(10,4) NOT NULL DEFAULT 0,
  cumulative_percent NUMERIC(10,4) NOT NULL DEFAULT 0,
  justification TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE allocation_distribution_map (
  location TEXT PRIMARY KEY,
  share_percent NUMERIC(8,4) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_opex_records_updated_at
BEFORE UPDATE ON opex_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_opex_records_year ON opex_records(financial_year);
CREATE INDEX idx_opex_records_location ON opex_records(location);
CREATE INDEX idx_opex_records_category ON opex_records(category_it);
CREATE INDEX idx_opex_records_owner ON opex_records(owner);
CREATE INDEX idx_opex_records_coding ON opex_records(coding);
