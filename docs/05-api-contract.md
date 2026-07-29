# API Contract

Base URL is chosen in `app.js`:

- Local/file UI fallback: `http://localhost:3001`
- Hosted UI: same-origin URLs built from `APP_BASE_PATH`
- Optional override: `localStorage.API_BASE_OVERRIDE`

## Base-Path Routing Boundary

The public deployment prefix is configuration, not business logic.

Frontend and backend URLs must be generated from `APP_BASE_PATH`. No feature module may hardcode `/budget-app`.

When `APP_BASE_PATH=/budget-app`, existing API paths are available under the prefix, for example:

- `/budget-app/api/budget-data`
- `/budget-app/api/allocation-data`
- `/budget-app/api/allocation-matrix`

When `APP_BASE_PATH` is empty, root-mode paths continue unchanged.

Phase 5B derives the API base path from `APP_BASE_PATH`. Examples:

- root deployment: `/api/auth/login`
- `/budget` deployment: `/budget/api/auth/login`
- `/apps/it-opex` deployment: `/apps/it-opex/api/auth/login`

When a non-root base path is configured, unprefixed `/api/*` is not a supported API bypass. Unprefixed `/health/live` and `/health/ready` remain available for runtime health checks.

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
| `POST` | `/api/auth/login` | Authenticate with employee ID/email and password. | `{ identifier, password }` | `{ success, data: { user, expiresAt } }` plus HttpOnly cookie. |
| `POST` | `/api/auth/logout` | Revoke current server-side session. | none | `{ success, data: { loggedOut } }` plus matching cookie clear. |
| `GET` | `/api/auth/me` | Read authenticated user and authorization summary. | session cookie | `{ success, data: { user, roles, permissions, locations } }` |
| `POST` | `/api/auth/change-password` | Change password for authenticated user. | `{ currentPassword, newPassword }` | `{ success, data: { changed } }` |
| `GET` | `/api/rbac/roles` | List roles. | session with `role.view` | `{ success, data: { roles } }` |
| `GET` | `/api/rbac/permissions` | List permissions. | session with `permission.view` | `{ success, data: { permissions } }` |
| `GET` | `/api/rbac/roles/:roleId` | Read role details. | session with `role.view` | `{ success, data: { role } }` |
| `GET` | `/api/rbac/roles/:roleId/permissions` | Read role permissions. | session with `role.view` | `{ success, data: { permissions } }` |
| `PUT` | `/api/rbac/roles/:roleId/permissions` | Replace role-permission mappings. | session with `role.assign_permission`; `{ permissionCodes }` | `{ success, data: { role, permissions } }` |
| `GET` | `/api/rbac/users/:userId/roles` | Read user role assignments. | session with `user.view` | `{ success, data: { roles } }` |
| `PUT` | `/api/rbac/users/:userId/roles` | Replace user roles. | session with `user.assign_role`; `{ roleIds, validFrom?, validUntil? }` | `{ success, data: { roles } }` |
| `GET` | `/health/live` | Liveness check for load balancers/process managers. | none | `{ status: "alive" }` |
| `GET` | `/health/ready` | Readiness check; verifies database connectivity. | none | `200 { status: "ready", database: "connected" }` or `503 { status: "not-ready", database: "unavailable" }` |
| `GET` | `/app-config.js` | Safe frontend runtime configuration. | none | `window.APP_CONFIG = { basePath }` |

Phase 5B RBAC administration endpoints are protected. Existing financial APIs are not fully permission-protected until Phase 5D.

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

When `APP_BASE_PATH=/budget-app`, prefixed health compatibility routes also work:

- `/budget-app/health/live`
- `/budget-app/health/ready`

Unprefixed `/health/live` and `/health/ready` remain available for Docker and target-group health checks.

## Phase 3.2 Error Response Standard

Write endpoints now use the standard error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Safe user-facing message.",
    "requestId": "request-id"
  }
}
```

Success response shapes are preserved where feasible.

Supported public error codes include:

- `VALIDATION_ERROR`
- `RECORD_NOT_FOUND`
- `RECORD_CONFLICT`
- `DUPLICATE_RECORD`
- `ALLOCATION_TOTAL_INVALID`
- `DATABASE_UNAVAILABLE`
- `DEPENDENCY_UNAVAILABLE`
- `INTERNAL_ERROR`

`X-Request-ID` is returned on every request.

## Financial Formatting Boundary

API requests and responses continue to use raw numeric amount values. Phase 2 formatting is display/export formatting only.

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

The browser must parse formatted amount strings with `parseFinancialAmount` before API submission. The backend API contract was not changed for Phase 2.

## Phase 4A Frontend Request Safety

The frontend builds API URLs through `AppUrls.api(...)` in `app-utils.js`. Root mode and `APP_BASE_PATH=/budget-app` mode use the same API contract.

Phase 4A does not change request or response payload meanings.

Refresh ownership:

- Initial load fetches `budget-data`, `allocation-data`, and `allocation-matrix` through one lifecycle in `app.js`.
- Polling uses one interval and skips while the document is hidden.
- Each dataset loader uses single-flight behavior to avoid duplicate concurrent calls to the same endpoint.
- Write operations refresh only affected datasets where practical.

## Coding Normalization Boundary

```text
User search text
-> trimmed case-insensitive search key
-> canonical master-data record
-> original/canonical display value
-> unchanged API value semantics
```

Budget Planner coding search and suggestion deduplication are UI/source-list behaviors only. API field names and payload meanings are unchanged.

## Future Enterprise Workflow API Boundary

Future workflow APIs must be additive and must not replace existing planner/allocation endpoints without a compatibility phase.

Design documents:

- `docs/22-enterprise-api-design.md`
- `docs/20-workflow-state-machine.md`
- `docs/25-workflow-foundation-implementation.md`
- `docs/26-workflow-transition-contract.md`

Planned API families:

- `/api/workflows`
- `/api/latest-estimates`
- `/api/next-fy-budgets`
- `/api/transfers`
- `/api/variance`
- `/api/notifications`
- `/api/audit`

Existing formulas changed by the workflow API design: No.

## Phase 4B Workflow Foundation APIs

Implemented additive endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/workflows/:workflowId` | Read one workflow instance. |
| `GET` | `/api/workflows/entity/:entityType/:entityId` | Read workflow by entity reference. |
| `POST` | `/api/workflows` | Create a shadow workflow instance. |
| `POST` | `/api/workflows/:workflowId/transitions` | Apply a validated state transition. |
| `GET` | `/api/workflows/:workflowId/history` | Read workflow transition history. |
| `GET` | `/api/budget-cycles` | List budget cycles. |
| `POST` | `/api/budget-cycles` | Create a budget cycle. |

`GET /api/budget-data` remains backward-compatible and may include additive read-only workflow fields:

- `workflow_id`
- `workflow_status`
- `workflow_version`
- `workflow_is_locked`

Workflow state must change only through transition endpoints.

## Phase 4C Budget Workflow APIs

Additional implemented endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/workflows/:workflowId/actions` | Return backend-derived actions available from the current workflow state. |
| `GET` | `/api/workflows/queue` | Return paged Budget workflow queue rows with safe filters. |
| `GET` | `/api/workflows/summary` | Return backend Budget workflow state/action counts. |

`POST /api/workflows` is used by legacy Budget Planner rows to start workflow in `DRAFT`. `POST /api/workflows/:workflowId/transitions` remains the only state-change API and requires `action`, `expectedVersion`, `remarks`, and `idempotencyKey`.

Budget workflow APIs are additive. Existing Budget Planner, Allocation, Report, and Dashboard payload meanings are unchanged.

## Phase 4D Latest Estimate APIs

See `docs/35-latest-estimate-api-contract.md`.

Latest Estimate endpoints are additive under `/api/latest-estimates/*`. LE never overwrites Budget Planner values. The backend recalculates variance and rejects material variance saves without remarks.
## Phase 4E Next FY APIs

See `docs/41-next-fy-api-contract.md` for the Phase 4E Next FY endpoint contract. All Next FY routes are additive under `/api/next-fy/*`, preserve existing Budget and LE API meanings, and use the centralized success/error response conventions.

## Phase 4F Transfer APIs

See `docs/48-transfer-api.md`.

Transfer routes are additive under `/api/transfers/*`:

- create/list/read transfer requests,
- submit/review/approve/post/reverse transitions,
- transfer history,
- transfer dashboard,
- working budget balances.

Transfer posting creates immutable ledger entries. It does not update Budget Planner, LE, or Next FY source values. Existing API field meanings are unchanged.
