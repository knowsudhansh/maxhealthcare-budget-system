# Testing Checklist

## Formula Regression

- Capture baseline totals for each tab.
- Run formulas with the same raw input before and after refactor.
- Verify no numeric total changes.
- Verify allocation distribution sum equals expected amount.
- Verify dashboard export and UI totals match.

## Formatting Tests

Required cases:

```javascript
formatFinancialAmount(0)
formatFinancialAmount(1000)
formatFinancialAmount(100000)
formatFinancialAmount(1250000.5)
formatFinancialAmount(-100000)
formatFinancialAmount(null)
formatFinancialAmount(undefined)
formatFinancialAmount("1,00,000")
parseFinancialAmount("1,00,000")
parseFinancialAmount("₹ 1,00,000.50")
```

## API Tests

- Create planner record.
- Read planner records.
- Update planner record.
- Delete planner record.
- Upload Budget_Planner Excel.
- Duplicate upload row.
- Validation failure.
- Database unavailable.
- Allocation create/read/update/delete.

## Allocation Tests

- Create allocation.
- Read allocation.
- Edit only owner.
- Edit only amount.
- Edit coding.
- Edit financial year.
- Zero amount.
- Decimal amount.
- Invalid percentage.
- Allocation percentage total not equal to 100.
- Database error during update.
- Concurrent edit.
- Refresh after edit.
- UAT database round trip.

## Manual UAT Checklist

- Dashboard filters and totals.
- Budget Planner add/edit/delete.
- Budget Planner Excel upload.
- Saved records filters.
- Location Summary totals.
- Unit Wise Budget totals.
- Allocation Control submit.
- Allocation Matrix edit/delete.
- Utilization calculations.
- Comparison metrics.
- Report screen.
- Excel exports.
- Dashboard PDF export.
- Data refresh after API save.
- Indian financial formatting.
- Formula comparison with baseline.
- Error messages.

## Phase 2 Formatting Test Command

Implemented lightweight Phase 2 command:

```bash
npm run test:formatting
```

Additional Phase 2 cases include `10,000`, `12,50,000`, `1,00,00,000`, empty string, `100000`, `-1,00,000`, and invalid strings.

## Financial Formatting Boundary

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

Manual UAT must confirm display formatting changed while raw totals, formulas, API payload types, and Excel numeric cell types remain unchanged.

## Budget Planner Coding And Clear Tests

Implemented lightweight command:

```bash
npm run test:planner-ui
```

Coverage includes:

- Coding normalization for lowercase, uppercase, mixed-case, and spaced input.
- Case-insensitive deduplication.
- Case-insensitive partial search.
- Canonical uppercase preference when case-only duplicates exist.
- Static clear-button wiring checks for accessible clear controls and full-list reset behavior.

Manual UAT must verify Budget Planner clear buttons for Coding, Item, Sub Category (Mapped), Category_IT, Sub Category, New Category, App Cate., Cate.3, Cate.4, Owner1, Owner, and Cost Center / Department.

## Global Clearable Field Tests

Implemented lightweight command:

```bash
npm run test:clearable-fields
```

Coverage includes:

- Shared combo and native select clear markup.
- Dashboard, Saved Planner Records, Location Summary, Unit Wise Budget, Allocation Matrix, Allocation Control, and Comparison field coverage.
- Allocation Coding and Item dependency-reset hooks.
- Allocation Cost Distribution required-field exclusion.
- Focus/visibility styling hooks.

Manual UAT must confirm that clearing one independent filter preserves all other filters and rerenders only the affected screen state.

## Enterprise Workflow Platform Test Planning

The workflow platform design is documentation-only until an implementation phase starts.

Future workflow implementation must add tests for:

- Budget state transitions: Draft, Submitted, Under Review, Approved, Locked.
- LE state transitions: Draft, Submitted, Validated, Approved.
- Transfer state transitions: Draft, Submitted, Approved, Posted, Reversed.
- Next FY transitions: Generated, Reviewed, Approved, Locked.
- Invalid transition rejection.
- Locked entity edit rejection.
- Mandatory remarks for returns, variance exceptions, transfer submissions, and manual Next FY overrides.
- Workflow history creation.
- Notification event creation.
- Audit event creation.
- Permission-boundary naming without active RBAC enforcement.
- Formula regression before and after every workflow phase.

Existing formulas changed by workflow design: No.

## Phase 4B Workflow Test Command

Implemented:

```bash
npm run test:workflow
```

Coverage includes state-machine validation, invalid transitions, required remarks, transaction rollback, audit rollback, version conflict, idempotent retry, legacy status attachment, additive API routes, and static migration checks.

## Explicit All Clear Visibility

The explicit `All` option is a selected value, not an empty placeholder.

Clear-button visibility must distinguish:

- empty/unselected,
- placeholder,
- explicit `All`,
- specific selected value.

Expected visibility:

- Empty: hidden.
- Placeholder: hidden.
- Explicit `All`: visible.
- Specific selected value: visible.

## Phase 3.1 Environment And Pool Tests

Implemented lightweight command:

```bash
npm run test:phase3-1
```

Coverage includes:

- Missing `APP_ENV` rejection.
- Valid development configuration.
- Production localhost DB rejection.
- Production wildcard CORS rejection.
- Production `DB_SSL=false` rejection.
- Production secret names that look like UAT/test/development/local rejected.
- UAT secret names that look like Production rejected.
- Valid UAT and Production configuration.
- AWS Secrets Manager secret shape normalization and validation.
- Secret cache behavior without real AWS credentials.
- Singleton MySQL pool behavior with mocked `mysql2`.
- Startup `SELECT 1` success and failure behavior.
- Pool close behavior.
- `/health/live` and `/health/ready` response behavior without sensitive details.

Regression commands to run with Phase 3.1:

```bash
npm run test:formatting
npm run test:planner-ui
npm run test:clearable-fields
```

## Phase 3.2 Transaction And Error Tests

Implemented lightweight command:

```bash
npm run test:phase3-2
```

Coverage includes:

- Transaction commit, rollback, release, and original error preservation.
- Numeric validation with zero accepted and invalid strings rejected.
- Indian-formatted amount normalization only where allowed.
- Financial year, ID, and percentage validation.
- Request ID generation, safe inbound ID acceptance, unsafe inbound replacement, and response header.
- Public error response mapping for validation, not found, duplicate, conflict, database unavailable, and internal errors.
- Audit event redaction and transaction-connection usage.
- Optimistic-locking helper behavior.
- Allocation matrix transaction commit and rollback with formatted amount values preserved as numbers.

Regression commands:

```bash
npm run test:phase3-1
npm run test:formatting
npm run test:planner-ui
npm run test:clearable-fields
```

## Phase 3.2A Docker Tests

Implemented lightweight command:

```bash
npm run test:docker
```

Coverage includes:

- Dockerfile uses production dependency install.
- Runtime image runs as non-root.
- Health check uses `/health/ready`.
- Local app data and secret files are excluded by `.dockerignore`.
- Example compose file does not include real credentials.

Optional manual check when Docker is installed:

```bash
docker build -t max-it-opex-budget-app:local .
```

## Base-Path Routing Tests

Implemented lightweight command:

```bash
npm run test:base-path
```

Coverage includes:

- `APP_BASE_PATH` normalization and malformed path rejection.
- Root-mode routes continue working.
- `/budget-app` redirects to `/budget-app/`.
- `/budget-app/` serves the UI.
- `/budget-app/styles.css` serves CSS.
- `/budget-app/app-config.js` exposes only safe config.
- `/budget-app/api/budget-data` reaches the existing handler.
- Prefixed and unprefixed health endpoints work.
- `/budget-application` does not match `/budget-app`.
- Query strings are preserved.
- Frontend fetch calls use centralized API helpers.

## TiDB Demo Tests

Implemented lightweight command:

```bash
npm run test:tidb
```

Coverage includes:

- `DB_SSL_CA` path resolution from project root.
- Missing CA path validation.
- TLS config includes `rejectUnauthorized: true`.
- Missing CA file errors do not expose file paths or certificate contents.
- TiDB-style environment validation.
- Demo schema script contains no destructive table/data operations.
- Demo seed has 20 records, uses numeric database values, prepared statements, and transaction flow.
- Demo seed uses exactly the approved non-sequential coding list and does not generate fake `ITOPEX001` through `ITOPEX020` rows.
- Demo seed preserves `owner1` as the business owner group and `owner` as a separate owner field.
- Demo seed reruns update only rows carrying the `TIDB_DEMO_SEED_V2` marker and do not delete manual rows by coding alone.
- Demo seed idempotency with mocked DB calls.
- Sanitized health output does not expose TiDB host, password, or CA path.

Optional manual verification when real local credentials and CA are present:

```bash
npm run verify:tidb
```

## Phase 4A Stabilization Tests

Implemented lightweight command:

```bash
npm run test:phase4a
```

Coverage includes:

- Frontend initialization guards for `app.js` and `app-ui.js`.
- One refresh lifecycle and one polling interval owner.
- Single-flight dataset refresh protection.
- Hidden-page polling pause.
- Important `data-action` handlers using `withButtonActionLock`.
- Button busy state restoration after success and failure.
- Root and `/budget-app` API URL helper output.
- Runtime config loading before frontend URL helpers.
- No hardcoded root-relative `/api` fetch calls.
- Non-submit button expectations for shell and rendered controls.

## Phase 4A.1 First-Click Browser Tests

Implemented browser-level command:

```bash
npm run test:first-click
```

Coverage includes:

- Launching real Chrome/Edge through the Chrome DevTools Protocol.
- Root mode and `/budget-app` mode.
- Budget Planner Save while a numeric input has focus and a pending `change` event.
- One physical mouse click dispatching exactly one `POST /api/budget-submissions`.
- Budget Planner Edit opening on one physical mouse click.
- Budget Planner Delete dispatching exactly one `DELETE /api/budget-data/:id`.
- Allocation Submit with an input focused and an allocation combo open.
- Allocation Matrix Edit modal opening on one physical mouse click.
- Allocation Matrix modal Save dispatching exactly one matrix write.
- Allocation row Delete dispatching one matrix delete and one allocation delete.
- Dashboard filter clear buttons for Location, Coding, Financial Year, and Owner.
- Dashboard, Planner Saved Records, Allocation Matrix, and Report export buttons.
- Tab navigation changing views on one physical mouse click.
- Event trace capture for `pointerdown`, `mousedown`, `change`, `focusout`, and `click`.
- Representative keyboard focusability for action and navigation buttons.

Manual regression must also test Save, Update, Edit, Delete, Submit, Cancel, Clear, Export, tab navigation, dropdown controls, Dashboard filters, Planner actions, Allocation actions, Allocation Matrix actions, and Report actions with:

- a form input focused before clicking,
- a dropdown/combo open before clicking where applicable,
- exactly one click per action,
- exactly one network request for write actions.

## Phase 4A.3 Manual Acceptance Status

Manual Chrome/Edge click-through is still required. Automated Chromium coverage is not a substitute for marking manual acceptance as passed.

Before Phase 4A closes, manually record Pass/Fail/Not Applicable for:

- Budget Planner Save/Edit/Delete/Cancel/Clear/Export.
- Allocation Submit/Edit/Delete/Cancel/Clear/Coding dropdown/Cost Distribution controls.
- Allocation Matrix Edit modal/change cell/Save/Delete/Cancel/Export.
- Dashboard Location/Category/Coding/Financial Year/Owner clear and export.
- Reports, Location Summary, Unit Wise Budget, Comparison, Utilization, and Saved Planner Records filters/clear/export controls.
- All sidebar tabs.
- Keyboard Tab, Enter, Space, and Escape behavior where supported.

## Phase 4C Budget Workflow Tests

Implemented lightweight commands:

```bash
npm run test:workflow-actions
npm run test:workflow-enforcement
npm run test:workflow-queue
npm run test:workflow-dashboard
```

Coverage includes:

- Backend-derived action availability for Not Started, Draft, Submitted, Under Review, Approved, and Locked states.
- Feature-flagged Budget Planner edit/delete restrictions.
- Enforcement disabled preserving legacy behavior.
- Approval queue pagination cap and row mapping.
- Workflow dashboard summary counts.
- Workflow action modal/static UI affordances.
- Transition request payload fields for expected version and idempotency key.

## Phase 4D Latest Estimate Tests

Implemented commands:

```bash
npm run test:le
npm run test:le-variance
npm run test:le-api
npm run test:le-workflow
npm run test:le-ui
npm run test:le-migration
```

Coverage includes variance formulas, zero-budget behavior, severity thresholds, LE workflow transitions, migration safety, API route wiring, UI wiring, and backend-only variance calculation guardrails.
## Phase 4E Next FY

Run:

- `npm run test:nextfy`
- `npm run test:nextfy-generation`
- `npm run test:nextfy-api`
- `npm run test:nextfy-workflow`
- `npm run test:nextfy-ui`
- `npm run test:nextfy-migration`

These tests verify Next FY generation formulas, source snapshots, assumption priority, ambiguous-rule rejection, workflow transitions, API wiring, frontend tab wiring, migration safety, and environment flags.

## Phase 4F Transfers

Run:

- `npm run test:transfers`
- `npm run test:transfer-api`
- `npm run test:transfer-workflow`
- `npm run test:transfer-ledger`
- `npm run test:transfer-ui`
- `npm run test:transfer-migration`

These tests verify transfer validation, ledger math, posting/reversal entries, Transfer workflow transitions, additive migration safety, API wiring, UI wiring, and feature flags.

## TiDB Diagnostics

Run:

- `npm run test:tidb-diagnostics`
- `npm run verify:tidb:connection`
- `npm run verify:tidb`

The diagnostics tests verify safe database-error serialization, redaction, verification stages, DB/MYSQL conflict detection, missing CA handling, connection-only mode, schema error details, TLS status fallback, and server startup diagnostics.

## Phase 5A Authentication Foundation Tests

Run:

```bash
npm run test:auth
```

Coverage includes password hashing, password policy, session token hashing, HttpOnly cookie flags, auth environment validation, unauthenticated `/api/auth/me`, bootstrap safety checks, and the additive auth migration shape.

## Migration Runner Tests

Run:

```bash
npm run test:migration-runner
```

Coverage includes safe argument parsing, statement splitting, destructive-operation blocking, and rollback-comment handling.

## Phase 5B RBAC And Base Path

Run:

```bash
npm run test:rbac
npm run test:base-path
```

Coverage includes RBAC registry seeding, permission middleware, effective permission resolution, root/prefixed/nested route handling, auth and RBAC routes below `APP_BASE_PATH`, cookie path matching, and prevention of unprefixed `/api/*` bypass when a non-root base path is configured.

Manual authenticated RBAC UAT remains blocked until the Phase 5A bootstrap administrator is created with safe credentials.

## Phase 5C Location Access

Run:

```bash
npm run test:location-access
npm run location:analyze-existing
```

Coverage includes direct and hierarchy assignments, explicit global access, expired/future assignment exclusion, disabled-location exclusion, location middleware, protected APIs, root/subpath/nested route behavior, unprefixed bypass prevention, and location analysis over existing business data.

## Kubernetes Dev Deployment

Run:

```bash
npm run test:k8s
```

Coverage verifies that `k8s/dev` manifests keep DB credentials and `AUTH_SESSION_SECRET` in Secret references, set `APP_BASE_PATH=/budget-app`, mount the TiDB CA as a file, use `/budget-app/health/ready` for readiness, use `/health/live` for liveness, preserve the ALB prefix, and avoid committed Secret data.
