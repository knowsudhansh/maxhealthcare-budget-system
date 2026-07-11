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

