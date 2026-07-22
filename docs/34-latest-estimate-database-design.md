# Latest Estimate Database Design

Migration:

```text
migrations/010_latest_estimate_foundation.sql
```

## Tables

- `latest_estimate_matrices`: matrix header, workflow linkage, version, status, financial year.
- `latest_estimate_cells`: sparse changed-cell records with Budget snapshot and backend-calculated variance.
- `variance_logs`: append-only material variance history.
- `latest_estimate_save_batches`: idempotency record for bulk saves.

## Storage Model

The logical matrix is `Coding x Location`, but the database stores only changed LE cells. Paged reads synthesize baseline rows from `budget_submissions` and join saved LE cells.

## Compatibility

No existing Budget, Allocation, Dashboard, or Report table is altered. No production migration was applied by this phase.
