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

## Restore Procedure Draft

1. Stop application writes.
2. Confirm target environment.
3. Restore RDS snapshot or point-in-time backup.
4. Run schema migration status check.
5. Start backend.
6. Validate `/health/ready`.
7. Validate planner totals.
8. Validate allocation matrix.
9. Validate exports.

## Current Risks

- localStorage is not reliable backup.
- Excel and Google Sheets are not authoritative.
- No migration version table exists.
- No automated backup verification exists.

