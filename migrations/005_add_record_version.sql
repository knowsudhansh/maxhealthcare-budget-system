-- Phase 3.2 proposal only. Do not apply to Production without approval.
-- Adds optimistic-locking foundation for active write tables.

ALTER TABLE budget_submissions
  ADD COLUMN record_version INT NOT NULL DEFAULT 1;

ALTER TABLE allocation_records
  ADD COLUMN record_version INT NOT NULL DEFAULT 1;

ALTER TABLE allocation_matrix
  ADD COLUMN record_version INT NOT NULL DEFAULT 1;
