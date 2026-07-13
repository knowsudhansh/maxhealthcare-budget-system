# Optimistic Locking Plan

## Status

Phase 3.2 adds the optimistic-locking foundation only. Runtime enforcement is not activated until the database has `record_version` columns.

## Proposed Migration

See:

```text
migrations/005_add_record_version.sql
```

Suggested column:

```sql
record_version INT NOT NULL DEFAULT 1
```

Tables:

- `budget_submissions`
- `allocation_records`
- `allocation_matrix`

## Intended Update Pattern

```sql
UPDATE table_name
SET
  ...,
  record_version = record_version + 1
WHERE id = ?
  AND record_version = ?;
```

If zero rows are affected, return:

```json
{
  "success": false,
  "error": {
    "code": "RECORD_CONFLICT",
    "message": "This record was changed by another user. Refresh and review the latest version.",
    "requestId": "..."
  }
}
```

## Compatibility

Current runtime does not assume `record_version` exists. Do not claim optimistic locking is active until migration 005 is applied and write routes are updated to require the client-read version.
