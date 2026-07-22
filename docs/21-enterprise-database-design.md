# Enterprise Database Design

## Compatibility Rule

Do not break existing tables or active API routes. New workflow tables should reference existing records rather than replacing them in one step.

Active compatibility tables:

- `budget_submissions`
- `allocation_records`
- `allocation_location_map`
- `allocation_matrix`

## Proposed Tables

### `budget_cycles`

Tracks financial-year workflow containers.

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGINT` PK | Surrogate key. |
| `financial_year` | `VARCHAR(20)` UNIQUE | Existing app year label. |
| `cycle_status` | `VARCHAR(40)` | Open, budget_locked, le_open, nextfy_locked. |
| `created_at` | `TIMESTAMP` | |
| `updated_at` | `TIMESTAMP` | |

### `workflow_instances`

Generic lifecycle state per entity.

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGINT` PK | |
| `entity_type` | `VARCHAR(60)` | BUDGET_RECORD, BUDGET_CYCLE, LE_MATRIX, TRANSFER, NEXT_FY_BUDGET. |
| `entity_id` | `VARCHAR(80)` | Existing or new entity id. |
| `workflow_type` | `VARCHAR(60)` | BUDGET, LE, TRANSFER, NEXT_FY. |
| `current_state` | `VARCHAR(40)` | Draft, Submitted, etc. |
| `record_version` | `INT` | Optimistic locking. |
| `locked_at` | `TIMESTAMP NULL` | |
| `created_at` | `TIMESTAMP` | |
| `updated_at` | `TIMESTAMP` | |

### `workflow_history`

Immutable transition history.

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGINT` PK | |
| `workflow_instance_id` | `BIGINT` FK | |
| `from_state` | `VARCHAR(40)` | |
| `to_state` | `VARCHAR(40)` | |
| `action` | `VARCHAR(80)` | |
| `reason` | `TEXT` | Mandatory for returns/rejections/unlocks. |
| `changed_by` | `VARCHAR(120)` | Temporary `legacy-user` until auth. |
| `request_id` | `VARCHAR(80)` | |
| `created_at` | `TIMESTAMP` | |

### `budget_versions`

Snapshots approved/locked budget rows without overwriting current records.

### `latest_estimate_matrices`

Header for LE matrix batches.

### `latest_estimate_cells`

Sparse Coding x Location LE grid.

Important columns:

- `matrix_id`
- `coding`
- `location`
- `current_budget DECIMAL(18,2)`
- `le_amount DECIMAL(18,2)`
- `remarks`
- `record_version`

Unique key: `(matrix_id, coding, location)`.

### `variance_logs`

Stores LE and Next FY exception evidence.

Important columns:

- `entity_type`
- `entity_id`
- `variance_type`
- `base_amount DECIMAL(18,2)`
- `proposed_amount DECIMAL(18,2)`
- `amount_difference DECIMAL(18,2)`
- `percentage_difference DECIMAL(10,4)`
- `threshold_code`
- `status`
- `remarks`

### `next_fy_budgets`

Header for generated next-year budgets.

### `next_fy_budget_lines`

Versioned generated rows.

Important columns:

- `next_fy_budget_id`
- `coding`
- `location`
- `le_amount`
- `growth_percent`
- `adjustment_amount`
- `generated_amount`
- `manual_amount`
- `remarks`
- `record_version`

### `budget_transfers`

Transfer header/ledger.

Important columns:

- `financial_year`
- `location`
- `unit`
- `from_coding`
- `to_coding`
- `amount`
- `status`
- `remarks`
- `reversal_of_transfer_id`
- `workflow_instance_id`
- `record_version`

### `transfer_history`

Immutable transfer events, including posting and reversal.

### `fixed_cost_changes`

Tracks fixed cost changes.

Important columns:

- `budget_submission_id`
- `old_value`
- `new_value`
- `difference_amount`
- `reason`
- `changed_by`
- `request_id`

### `notifications`

In-app workflow notification events. Email/SMS are out of scope.

## ER Diagram

```text
budget_cycles
  | 1..n
  v
budget_submissions 1..n budget_versions
  |                    |
  |                    v
  |              fixed_cost_changes
  |
  +-- workflow_instances < workflow_history

latest_estimate_matrices 1..n latest_estimate_cells 1..n variance_logs
  |
  +-- workflow_instances < workflow_history

next_fy_budgets 1..n next_fy_budget_lines 1..n variance_logs
  |
  +-- workflow_instances < workflow_history

budget_transfers 1..n transfer_history
  |
  +-- workflow_instances < workflow_history

notifications -> entity_type/entity_id
audit_logs     -> entity_type/entity_id
```

## Migration Strategy

1. Add tables as new migrations only; do not alter existing behavior first.
2. Backfill workflow instances for existing rows as `Draft` or `Legacy Imported` after business confirmation.
3. Add read-only workflow projections before blocking edits.
4. Activate state transition APIs.
5. Add lock enforcement to write routes only after UAT confirms migration.
