# Workflow Migration Runbook

## Migration File

```text
migrations/009_workflow_foundation.sql
```

## Safety

The migration is additive. It creates:

- `budget_cycles`
- `workflow_instances`
- `workflow_history`

It does not alter or delete:

- `budget_submissions`
- `allocation_records`
- `allocation_location_map`
- `allocation_matrix`
- financial values

## Execution Rule

Do not run this migration against Production, UAT, TiDB demo, or AWS without explicit approval.

## Manual Execution Outline

1. Take a database backup.
2. Confirm target environment.
3. Run the migration in a transaction where supported by the deployment procedure.
4. Verify table existence.
5. Verify indexes.
6. Run workflow API smoke tests.
7. Run formula regression tests.

## Backfill

Dry-run command:

```bash
npm run workflow:backfill:dry-run
```

This reports how many `budget_submissions` rows do not yet have workflow instances.

Apply mode requires both:

```bash
WORKFLOW_BACKFILL_APPLY=true
npm run workflow:backfill:dry-run -- --apply
```

Do not run apply mode in Production/UAT/TiDB demo without approval.

## Rollback

Rollback is manual and should only happen if no workflow data must be retained:

```sql
DROP TABLE workflow_history;
DROP TABLE workflow_instances;
DROP TABLE budget_cycles;
```
