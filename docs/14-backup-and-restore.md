# Backup And Restore

## Current Backup Sources

- MySQL database.
- Local Excel mirror: `server data/it-opex-budget-submissions.xlsx`.
- Browser localStorage cache.
- Optional Google Sheet append target.

## UAT/Production Backup Target

For AWS:

- RDS automated backups.
- Point-in-time recovery enabled.
- Manual snapshot before deployment.
- Snapshot before migration.
- Export/import procedure tested in UAT.

Phase 3.1 does not provision RDS, modify production data, or change schema. It prepares the app to connect to a future UAT/Production RDS database through a validated environment and singleton connection pool.

## Restore Procedure Draft

1. Stop application writes.
2. Confirm target environment.
3. Restore RDS snapshot or point-in-time backup.
4. Run schema migration status check.
5. Start backend.
6. Validate `/health/live`.
7. Validate `/health/ready`.
8. Validate planner totals.
9. Validate allocation matrix.
10. Validate exports.

## Current Risks

- localStorage is not reliable backup.
- Excel and Google Sheets are not authoritative.
- No migration version table exists.
- No automated backup verification exists.
