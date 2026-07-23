# Next FY Budget Engine

Phase 4E introduces a standalone Next Financial Year Budget module. It generates draft next-year lines from eligible source snapshots and never overwrites Budget Planner or Latest Estimate records.

## Workflow

Approved or locked Current Budget and approved Latest Estimate data can be selected as source inputs. The user creates a Next FY budget shell, configures planning assumptions, previews the impact, generates lines, adjusts draft lines, starts review, approves, and locks.

## Source Strategies

- `APPROVED_LE`: uses only an approved Latest Estimate matrix.
- `CURRENT_BUDGET`: uses only Budget records with workflow state `APPROVED` or `LOCKED`.
- `HYBRID`: uses approved LE where available and eligible Budget rows as fallback.
- `MANUAL_BASELINE`: disabled by default and controlled by `NEXT_FY_ALLOW_MANUAL_BASELINE`.

## Non-Overwrite Boundary

Next FY stores source snapshots in `next_fy_budget_lines`. Changes to source Budget or LE records after generation do not silently update a generated Next FY budget.

## Mutability

`GENERATED` is editable. `UNDER_REVIEW`, `APPROVED`, and `LOCKED` are read-only in backend policy and frontend controls.
