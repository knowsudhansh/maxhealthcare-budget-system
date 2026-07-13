# Database Schema

## Active Database

The active backend uses MySQL through `mysql2/promise`.

Configured by:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`

## Tables Used By `server.js`

| Table | Used By | Notes |
|---|---|---|
| `budget_submissions` | Budget CRUD and import | Active source for `GET /api/budget-data`. Schema file is incomplete compared with server expectations. |
| `allocation_records` | Allocation control | Application treats `(coding, owner, financialYear)` as key, but schema file unique key only lists `(coding, owner)`. |
| `allocation_location_map` | Allocation percentages | Backend falls back to hard-coded 19-location map if empty. |
| `allocation_matrix` | Allocation matrix | Stores amount and percent JSON per row. |

## Tables Present But Not Actively Used By Server

| Table | Notes |
|---|---|
| `planner_records` | Richer schema in `sql/mysql-app-schema.sql`, but current server does not query it. |
| PostgreSQL `opex_records` from `sql/sql.sql` | Not used by Express/MySQL server. |

## Schema Drift Findings

- `budget_submissions` in `sql/mysql-app-schema.sql` lacks fields actively used by server: `financial_year`, `location`, amount fields, and newer import fields.
- `server.js` has runtime column patching for `sub_category_mapped`, `cost_distribution`, and `justification`.
- `allocation_records.id` is `VARCHAR(80)` in schema, but delete endpoint parses `id` as number.
- `allocation_records` unique key in schema omits `financial_year`, but backend select/upsert expects year-specific records.
- No migration version table exists.
- No audit tables exist.
- No record version/optimistic-locking fields exist.

## Required Migration Direction

Create versioned migrations before UAT/Production:

- `001_initial_schema.sql`
- `002_locations_master.sql`
- `003_allocation_tables.sql`
- `004_audit_logs.sql`
- `005_record_version.sql`
- `006_future_rbac_tables.sql`

Do not apply manual production schema changes.

## Phase 3.2 Local Migration Proposals

Added proposal files only:

- `migrations/005_add_record_version.sql`
- `migrations/006_create_audit_logs.sql`

These were not applied to UAT or Production.

`record_version` is required before optimistic locking can be activated. `audit_logs` is required before audit persistence can be enabled.

## TiDB Cloud Starter Demo Schema

Phase TiDB demo preparation adds:

```text
migrations/008_tidb_demo_schema.sql
```

This script is idempotent and non-destructive. It uses only:

- `CREATE TABLE IF NOT EXISTS`
- `INSERT ... ON DUPLICATE KEY UPDATE` for the allocation percentage map

It does not drop, clear, or overwrite existing planner data.

Active tables required by the current application:

- `budget_submissions`
- `allocation_records`
- `allocation_location_map`
- `allocation_matrix`

The TiDB demo schema follows the active `server.js` queries. Notably, `allocation_records.id` is numeric auto-increment because active delete routes parse IDs as positive integers and the active insert does not provide an ID.

Do not apply optimistic-locking or audit-log proposal migrations to the TiDB demo unless explicitly requested.

Temporary demo data is inserted by `scripts/seed-tidb-demo.js` into `budget_submissions` only. The approved seed rows are documented in `docs/18-tidb-demo-seed.md` and are identified by `TIDB_DEMO_SEED_V2`.
