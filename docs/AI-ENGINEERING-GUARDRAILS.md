# AI Engineering Guardrails

## Formula Protection

Do not change any formula unless:

1. Business approval is recorded.
2. `docs/04-formula-register.md` is updated.
3. Regression tests are updated.
4. UAT validation is completed.
5. `docs/CHANGELOG.md` is updated.

## Implementation Discipline

- Inspect active source before changing code.
- Prefer small changes.
- Preserve active behavior.
- Do not remove legacy files without documenting why.
- Do not rename API fields without compatibility mapping.
- Do not change DB columns without migration.
- Do not format values before calculations.
- Do not save formatted financial strings to numeric DB columns.
- Do not expose secrets.
- Do not mix UAT and Production.
- Do not silently ignore failed DB writes.
- Do not continue after transaction failure.
- Do not implement incomplete auth/RBAC.
- Do not implement chatbot without RBAC-enforced boundaries.

## Financial Formatting Boundary

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

- Use `formatFinancialAmount` only at display, PDF, report, and export-format boundaries.
- Use `parseFinancialAmount` before calculations or API submission if an amount may contain commas or a currency symbol.
- Keep database values, API payloads, localStorage records, chart datasets, and internal totals numeric.
- Use `en-IN` as the approved display locale.
- Existing formulas must remain unchanged when formatting is adjusted.

## Coding Normalization Boundary

```text
User search text
-> trimmed case-insensitive search key
-> canonical master-data record
-> original/canonical display value
-> unchanged API value semantics
```

- Coding comparison and search are case-insensitive.
- Coding suggestions must be deduplicated by normalized coding key.
- The application must never show duplicate Coding suggestions that differ only by letter case.
- Normalized keys are for comparison, filtering, and deduplication only; do not overwrite database data with normalized values.

## Budget Planner Field Clear Boundary

- Clear buttons must update visible input and application state.
- Clearing Coding or Item may clear only the fields currently mapped from coding/item selection.
- Individually selectable Planning Input fields clear only themselves unless an explicit dependency exists.
- Clear actions must not submit forms or change API payload meanings.

## Global Clearable-Field Boundary

```text
Selected display value
-> selected application state
-> filtered option state
-> dependent mapped state
-> clear action
-> reset to valid default
-> rerender affected screen only
```

- Every active filter or selectable field that supports a valid empty/default state should provide a consistent clear action.
- Clearing a field must clear both visible and internal state.
- Clearing one independent filter must not reset unrelated filters.
- Required workflow selectors without a valid empty state must be excluded and documented.

## Explicit All Is Selected State

The explicit `All` option is a selected value, not an empty placeholder.

Clear-button visibility must distinguish:

- empty/unselected,
- placeholder,
- explicit `All`,
- specific selected value.

Do not include `All`, `ALL`, `all`, or `*` in generic empty/default detection.

## Documentation First

Before major changes:

- Update architecture docs if affected.
- Update data dictionary if fields are added/changed.
- Update API contract if request/response changes.
- Update formula register if formulas change.
- Update testing checklist.
- Update changelog.

## Enterprise Workflow Platform Boundary

- Do not implement authentication or RBAC before workflow action boundaries are defined and accepted.
- Do not change budget, allocation, LE, utilization, comparison, or dashboard formulas while adding workflow state.
- Workflow state controls action eligibility; it must not redefine financial calculations.
- New workflow tables must be additive and backward-compatible with `budget_submissions`, `allocation_records`, `allocation_location_map`, and `allocation_matrix`.
- Permission names such as `budget.approve` and `le.validate` are design boundaries until login/RBAC is explicitly implemented.
- Never use UI hiding as the only workflow protection; backend transition validation is required when workflows are implemented.
- Do not use localStorage, Excel, or Google Sheets as workflow source of truth.
- Keep `owner1` as business owner group and `owner` as person/operational owner.
- Future AI must call allowlisted backend services only and must never receive unrestricted SQL, filesystem, environment, or credential access.

## Phase 4B Workflow Foundation Guardrails

- Never change `current_state` directly through a generic update API.
- All workflow changes must use the transition service.
- Never update workflow state without workflow history.
- Never write workflow history outside the state transaction.
- Never bypass optimistic version checks.
- Never enforce `LOCKED` behavior against Budget Planner until the approved enforcement phase.
- Never infer actor identity from arbitrary client input.
- Never merge workflow history with financial version history.
- Never backfill production records automatically.
- Never alter budget formulas through workflow logic.
- Never reuse `owner` or `owner1` as workflow approver identity.
- Preserve `APP_BASE_PATH` for all new APIs and frontend calls.

## Phase 3.1 Runtime Configuration Guardrails

- `APP_ENV` must be explicit.
- Development may use direct local DB credentials.
- UAT and Production must require `DB_SSL=true`.
- Production must reject wildcard CORS, localhost DB hosts, and secret names that look like UAT/test/development/local.
- UAT must reject secret names that look like Production.
- AWS Secrets Manager values must be loaded server-side only and cached; never fetch secrets per request.
- Do not log DB credentials, DB host/name, secret ARN, SQL, stack traces, or AWS account details in public responses.
- Keep formulas and API field meanings unchanged while refactoring runtime infrastructure.

## Phase 3.2 Write Reliability Guardrails

- Use `withTransaction` for multi-step allocation writes.
- Validate numeric inputs before writes; do not use `Number(value) || 0` for request validation.
- Preserve explicit allocation edit amounts; do not redistribute edited matrix rows unless the client omitted explicit amounts.
- Return standard public error responses with request IDs.
- Do not activate optimistic locking until `record_version` migration is applied.
- Do not enable audit persistence until `audit_logs` migration is applied.
- Existing formulas changed: No.

## Phase 3.2A Containerization Guardrails

- Docker packaging must not copy `.env`, local app data, service-account JSON, logs, or `node_modules` into the image.
- The container must run as a non-root user.
- Container health checks should use `/health/ready`.
- Containerization must not change formulas, API field meanings, database schema, or persistence behavior.
- Do not push images or provision AWS resources in Phase 3.2A.

## Base-Path Routing Guardrails

The public deployment prefix is configuration, not business logic.

Frontend and backend URLs must be generated from `APP_BASE_PATH`. No feature module may hardcode `/budget-app`.

- Keep unprefixed `/health/live` and `/health/ready` for internal container and target-group checks.
- Expose only safe frontend runtime configuration through `/app-config.js`.
- Do not serve `.env`, `node_modules`, migrations, tests, service-account files, keys, certificates, logs, or `Server data`.
- Base-path support must not change formulas, API field meanings, save/edit/delete semantics, or data.

## TiDB Demo Guardrails

- TiDB Cloud Starter may be used only as a temporary shared demo database unless separately approved for production.
- Use environment variables for all TiDB connection settings.
- Treat `DB_SSL_CA` as a local file path and never commit certificate files.
- Keep TLS verification enabled; never use `rejectUnauthorized: false`.
- Do not log credentials, connection strings, CA contents, CA file paths, or secret values.
- Do not run demo seed automatically during startup.
- Demo schema setup must be idempotent and non-destructive.
- Demo Budget Planner rows must be seeded only from the approved coding mapping, not generated sequentially.
- Coding master values and Budget Planner transaction rows are separate concepts; do not seed the complete master list as transactions.
- `owner1` is the business owner group and must not be overwritten by person-level `owner`.
- Demo seed cleanup must be marker-scoped and must never delete real records by coding alone.
- Existing formulas changed: No.

## Phase 4A UI Stabilization Guardrails

- Never attach events during repeated rendering without cleanup.
- Never initialize the whole application twice.
- Never add polling without a single lifecycle owner.
- Never use localStorage as the financial source of truth.
- Never hardcode root API paths.
- Never bypass runtime base-path helpers.
- Never change formulas as part of a UI fix.
- Never alter coding master data during stabilization.
- Never expose database errors or secrets.
- Never weaken tests to hide defects.

`app.js` owns the refresh lifecycle and write-action orchestration. `app-ui.js` owns render output and delegated combo/select UI behavior.

## Phase 4A.1 First-Click Guardrails

- Never rerender a container during a pointer sequence if that container contains the action target.
- Never let blur/change or dropdown-close handlers consume unrelated button actions.
- Never rely on a second click, synthetic click, or arbitrary delay to make an action work.
- Always test action buttons while a form input has focus.
- Always test action buttons while a dropdown/combo is open when that screen supports it.
- Every critical write action should have one-click browser coverage before new enterprise modules are added.
- Action locks must start the action on the first click and block only duplicate concurrent execution.
- Pointer render gates must have cancellation release paths; queued renders must not remain deferred indefinitely.
- Browser tests should count network requests for critical writes so one user action does not produce duplicate write requests.
- Phase 4B must not begin unless Phase 4A completion declarations are all `Yes`, except items explicitly accepted as external infrastructure limitations by the project owner.

## Phase 4C Budget Workflow Guardrails

- Never change `current_state` through a generic update API.
- All workflow state changes must use the transition service.
- Never decide available workflow actions only in the frontend.
- Never update workflow state without workflow history in the same transaction.
- Never bypass optimistic version checks.
- Never enforce Planner locks unless `WORKFLOW_LOCK_ENFORCEMENT_ENABLED=true`.
- Never infer actor identity from `owner` or `owner1`.
- Never use `owner` or `owner1` as workflow approver identity.
- Never implement RBAC by hiding buttons only; backend enforcement belongs in the RBAC phase.
- Never change financial formulas through workflow logic.
- Preserve APP_BASE_PATH helpers for every new frontend workflow API call.

## Phase 4D Latest Estimate Guardrails

- Never overwrite Budget Planner values from LE.
- Never calculate variance from formatted display strings.
- Never allow the frontend to provide authoritative variance values.
- Backend must recalculate variance.
- Never return `NaN` or `Infinity`.
- Never mutate approved LE data.
- Never save LE cells outside a matrix transaction.
- Never bypass matrix or cell version checks.
- Never duplicate a save batch for the same idempotency key.
- Never require the browser to load the complete logical matrix.
- Never treat legacy source data as approved.
- Never automatically rebase an existing matrix.
- Never apply migrations automatically to production.
- Never commit `.env`, private keys, certificates, or credentials.
- Preserve APP_BASE_PATH for every new route and frontend request.
- Preserve first-click and pointer-render protections.
