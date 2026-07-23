# Next FY Database Design

Migration `011_next_fy_budget_foundation.sql` is additive and TiDB-compatible.

## Tables

- `next_fy_budgets`: budget header, source strategy, source version, target FY, workflow link, totals, and status.
- `next_fy_budget_lines`: immutable source snapshot plus generated and adjusted values.
- `planning_assumption_rules`: global, location, coding, category, owner, fixed amount, and override rules.
- `next_fy_generation_batches`: idempotent generation summary.
- `next_fy_adjustment_history`: append-only manual adjustment history.

## Important Indexes

- `uk_next_fy_budget_code`
- `uk_next_fy_line_identity`
- source, target FY, workflow, status, coding, location, owner, owner1, category indexes.

## Rollback

Rollback is documented in migration comments for isolated non-production environments only. No production migration is applied automatically.
