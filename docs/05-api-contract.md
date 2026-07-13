# API Contract

Base URL is chosen in `app.js`:

- Local/file UI: `http://localhost:3001`
- Hosted UI: `https://maxhealthcare-budget-system-production.up.railway.app`
- Optional override: `localStorage.API_BASE_OVERRIDE`

## Endpoints

| Method | Path | Purpose | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/budget-submissions` | Save one budget planner record. | Budget submission JSON with Excel-style fields and snake-case numeric fields. | `{ message, googleRange, mysqlInsertId, totalRows }` |
| `POST` | `/api/budget-planner/import` | Bulk import Budget_Planner rows. | `{ rows: [...] }` normalized budget rows. | `{ received, created, updated, skipped, errors }` |
| `GET` | `/api/budget-data` | Load planner rows. | none | Array of `budget_submissions` rows. |
| `PUT` | `/api/budget-data/:id` | Update one planner row by numeric DB id. | Budget submission JSON. | `{ message, affectedRows }` |
| `DELETE` | `/api/budget-data/:id` | Delete one planner row by numeric DB id. | none | `{ message, affectedRows }` |
| `GET` | `/api/allocation-data` | Load allocation control records. | none | Array from `allocation_records`. |
| `POST` | `/api/allocation-data` | Upsert allocation control record. | `{ coding,item,owner,financialYear,mode,amountInput,percentInput,targetAmount }` | Saved allocation row. |
| `DELETE` | `/api/allocation-data/by-key` | Delete allocation control by coding/owner/year. | Query params. | `{ message, affectedRows }` |
| `DELETE` | `/api/allocation-data/:id` | Delete allocation control by id. | none | `{ message, affectedRows }` |
| `GET` | `/api/allocation-map` | Read allocation location map. | none | Array `{ location, percent }`. |
| `GET` | `/api/allocation-matrix` | Load allocation matrix. | none | Array from `allocation_matrix`. |
| `POST` | `/api/allocation-matrix` | Upsert allocation matrix. | Matrix payload; can include explicit `locationAmounts` and `locationPercents`. | Saved matrix row. |
| `DELETE` | `/api/allocation-matrix/by-key` | Delete matrix by year/coding/owner/distribution. | Query params. | `{ message, affectedRows }` |
| `DELETE` | `/api/allocation-matrix/:id` | Delete matrix by numeric id. | none | `{ message, affectedRows }` |
| `GET` | `/api/health` | Health check. | none | `{ message, mysql }` |
| `GET` | `/health/live` | Liveness check for load balancers/process managers. | none | `{ status: "alive" }` |
| `GET` | `/health/ready` | Readiness check; verifies database connectivity. | none | `200 { status: "ready", database: "connected" }` or `503 { status: "not-ready", database: "unavailable" }` |

## Current Contract Risks

- Responses are inconsistent; there is no standard `{ success, error }` envelope.
- Errors expose raw messages in many places.
- No request ID.
- No central validation schema.
- CORS is `*`.
- `budget_submissions` insert writes Excel/Google/MySQL in one request without transaction semantics.
- API fields mix display names, camelCase, and snake_case.

## Phase 3.1 Health Contract

`GET /api/health` is retained for compatibility. Its database details are sanitized and must not expose DB host, DB name, username, password, secret ARN, SQL, stack traces, or AWS account identifiers.

`GET /health/live` confirms the Node process is alive.

`GET /health/ready` confirms the singleton MySQL pool can run `SELECT 1`. Traffic should not be sent to the service until readiness succeeds.

## Financial Formatting Boundary

API requests and responses continue to use raw numeric amount values. Phase 2 formatting is display/export formatting only.

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

The browser must parse formatted amount strings with `parseFinancialAmount` before API submission. The backend API contract was not changed for Phase 2.

## Coding Normalization Boundary

```text
User search text
-> trimmed case-insensitive search key
-> canonical master-data record
-> original/canonical display value
-> unchanged API value semantics
```

Budget Planner coding search and suggestion deduplication are UI/source-list behaviors only. API field names and payload meanings are unchanged.
