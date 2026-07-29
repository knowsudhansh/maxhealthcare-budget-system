# Changelog

## Unreleased

### Phase 5B RBAC Authorization And Base Path

- Added database-backed RBAC role and permission registry.
- Added idempotent RBAC seed command and protected RBAC administration APIs.
- Added trusted permission resolution from server-side sessions.
- Added reusable permission middleware for `401` and `403` authorization handling.
- Standardized safe frontend `apiBasePath` runtime config and base-path-aware session cookie paths.
- Blocked unprefixed `/api/*` bypass when a non-root `APP_BASE_PATH` is configured.
- Added focused RBAC and base-path tests.
- Existing formulas changed: No.

### TiDB Diagnostics Hardening

- Added safe database-error diagnostics with verification/startup stages.
- Added TiDB connection-only verification mode.
- Added DB/MYSQL environment conflict detection and deprecated fallback warnings.
- Improved server startup database error reporting without exposing secrets.
- Added TiDB diagnostics tests.
- Existing formulas changed: No.

### Phase 4F Enterprise Budget Transfer Engine

- Added additive transfer foundation migration proposal `012_budget_transfer_foundation.sql`.
- Added Transfer workflow states, permissions, and notification event constants.
- Added backend Transfer module for request creation, validation, lifecycle transitions, posting, reversal, history, dashboard, and working budget.
- Added Transfer tab with dashboard KPIs, request creation, approval/posting actions, posting history, working budget, and export.
- Added transfer feature flags and tests.
- Existing formulas changed: No.
- Approved Budget/LE/Next FY values overwritten by transfers: No.
- Authentication/RBAC implemented: No.

### Enterprise Workflow Platform Design

- Added enterprise workflow platform architecture documentation.
- Documented Budget, LE, Transfer, and Next FY lifecycle states and transition rules.
- Proposed additive workflow, LE matrix, variance, Next FY, transfer, notification, and fixed-cost tracking tables.
- Added REST API design and permission-boundary names for future RBAC mapping.
- Added frontend/backend modular architecture recommendations and implementation roadmap.
- Added ADR-001: build workflow foundation before authentication and RBAC.
- Existing formulas changed: No.
- Database data modified: No.

### Phase 4B Workflow Foundation

- Added additive workflow foundation migration proposal `009_workflow_foundation.sql`.
- Added reusable backend workflow module with state machine, repository, service, controller, routes, validation, and workflow-specific errors.
- Added workflow APIs for budget cycles, workflow instances, transitions, and history.
- Added optimistic version checks and idempotent transition retry handling.
- Added transaction-bound workflow history and optional audit integration.
- Added Budget Planner read-only workflow status and history modal in shadow mode.
- Added dry-run workflow backfill command.
- Added workflow foundation tests.
- Existing formulas changed: No.
- Workflow locks enforced on Planner: No.
- Authentication/RBAC implemented: No.

### Phase 4C Budget Workflow Actions

- Added Budget workflow action metadata, permission-boundary constants, and notification event names.
- Added backend-derived available actions, approval queue, and workflow summary APIs.
- Added feature-flagged backend Planner edit/delete enforcement with enforcement disabled by default.
- Added Budget Planner Start Workflow, transition modal, workflow action panel, workflow dashboard summary, and approval queue UI.
- Added workflow action/enforcement/queue/dashboard test commands.
- Existing formulas changed: No.
- Authentication/RBAC implemented: No.

### Phase 4D Latest Estimate Platform

- Added additive Latest Estimate schema proposal with sparse cells and variance logs.
- Added Latest Estimate backend module with variance calculation, bulk save, matrix summary, and workflow transitions.
- Added Latest Estimate tab with server-paged row editor and changed-cell save.
- Added LE feature flags and variance threshold configuration.
- Added Phase 4D tests and documentation set.
- Existing Budget values modified by LE: No.
- Existing formulas changed: No.
- Authentication/RBAC implemented: No.

### Documentation

- Added current-state system documentation for UAT/Production preparation.
- Added formula register with formula freeze rule.
- Added API, data dictionary, database, environment, deployment, security, RBAC, chatbot, testing, and backup documentation.

### Formula Impact

- Existing formulas changed: No.

### Implementation Notes

- This documentation pass does not implement Phase 2+ production changes.
- Any future formula refactor must be backed by regression tests and UAT validation.

### Phase 2 Financial Formatting

- Added centralized `formatFinancialAmount` and `parseFinancialAmount` utilities.
- Applied `en-IN` Indian financial display formatting through active UI helpers.
- Applied Excel number formats to financial cells while keeping workbook values numeric.
- Added lightweight formatter/parser and formula regression tests.
- Existing formulas changed: No.

### Budget Planner UI Correction

- Added case-insensitive Coding normalization and deduplication for Budget Planner suggestions.
- Added Planning Input clear buttons for searchable combo fields.
- Added dependency-aware clearing for Coding and Item mapped fields.
- Added lightweight planner UI normalization tests.
- Existing formulas changed: No.

### Global Clearable Fields

- Extended the clear-button pattern to active searchable dropdowns and native select filters across Dashboard, Saved Planner Records, Location Summary, Unit Wise Budget, Allocation, Allocation Matrix, and Comparison.
- Added shared native-select clear wrapper and delegated clear handling.
- Preserved required Allocation Cost Distribution behavior without a misleading clear button.
- Added lightweight global clearable-field tests.
- Existing formulas changed: No.

### Clear Button All-State Fix

- Fixed clear-button visibility so explicit `All` values show a clear button.
- Preserved empty/placeholder states as clear-button hidden.
- Updated clear behavior so clearing `All` returns fields to empty/placeholder state without resetting unrelated filters.
- Existing formulas changed: No.

### Phase 3.1 Runtime Configuration And Database Connectivity

- Added centralized environment validation for Development, UAT, and Production.
- Added placeholder-only `.env` example files for development, UAT, and production.
- Added AWS Secrets Manager compatibility for database credentials without fetching secrets per request.
- Added a singleton MySQL connection pool with startup `SELECT 1`, TLS support, configurable limits, and graceful close.
- Added `/health/live` and `/health/ready`; retained sanitized legacy `/api/health`.
- Added graceful `SIGTERM` and `SIGINT` shutdown.
- Added focused Phase 3.1 tests for environment validation, secret shape validation, pool behavior, and health responses.
- Existing formulas changed: No.
- Database schema modified: No.
- Remote AWS resources created: No.

### Phase 3.2 Write Reliability Foundation

- Added transaction helper using the Phase 3.1 singleton pool.
- Added request IDs, structured request logging, and centralized public error responses.
- Added validation helpers for budget and allocation write paths.
- Made allocation control/matrix writes transactional where related rows are written.
- Fixed allocation matrix edit parsing so Indian-formatted amount strings do not become zero.
- Added optimistic-locking and audit-log migration proposals only.
- Added audit service foundation with sensitive-field redaction.
- Added focused Phase 3.2 tests.
- Existing formulas changed: No.
- Database schema applied remotely: No.

### Phase 3.2A Docker Containerization

- Added Dockerfile for production-style Node runtime packaging.
- Added `.dockerignore` to exclude secrets, local app data, logs, and dependencies from the build context.
- Added `docker-compose.example.yml` for local container trials.
- Added lightweight Docker packaging checks.
- Existing formulas changed: No.
- Remote AWS resources modified: No.

### Base-Path Hosting Support

- Added configurable `APP_BASE_PATH` normalization and validation.
- Added `/app-config.js` safe frontend runtime config.
- Added backend base-path routing so `/budget-app/*` reaches existing UI/API/health handlers.
- Preserved unprefixed health endpoints for Docker and target-group health checks.
- Added frontend URL helpers and moved API calls to centralized URL construction.
- Restricted static serving to approved frontend assets.
- Added focused base-path routing tests.
- Existing formulas changed: No.

### TiDB Cloud Starter Demo Preparation

- Added `DB_SSL_CA` support for verified TLS connections through `mysql2`.
- Added TiDB demo schema proposal in `migrations/008_tidb_demo_schema.sql`.
- Added manual, idempotent TiDB demo seed script.
- Added sanitized TiDB connection/schema verification script.
- Added focused TiDB TLS/schema/seed safety tests.
- Updated local development env example with TiDB placeholder values.
- Existing formulas changed: No.

### TiDB Demo Coding Data Correction

- Replaced generated temporary demo seed rows with the 20 approved coding mappings.
- Preserved the distinction between `owner1` business owner group and person-level `owner`.
- Added marker-scoped V2 seed updates with old demo marker cleanup only.
- Documented the approved amount/location strategy in `docs/18-tidb-demo-seed.md`.
- Extended TiDB tests for approved codes, metadata, idempotency, Owner/Owner1 separation, and manual-row protection.
- Existing formulas changed: No.

### Phase 4A Stabilization

- Added idempotent frontend initialization guards for `app.js` and `app-ui.js`.
- Added `withButtonActionLock` for single-click async button reliability.
- Consolidated budget/allocation refresh into one lifecycle with single-flight request protection and hidden-page polling pause.
- Locked Budget Planner save/delete, export, Allocation delete/edit-save, and Allocation submit actions against duplicate concurrent requests.
- Added focused `npm run test:phase4a` coverage.
- Added UI behavior, path-routing, and AI context documentation.
- Existing formulas changed: No.

### Phase 4A.1 Browser First-Click Fix

- Confirmed the remaining lost-click class with a real Chrome/Edge browser test and event trace.
- Added a pointer render gate so blur/change-driven full renders cannot replace an action button between `pointerdown` and `click`.
- Added `npm run test:first-click` browser coverage for root and `/budget-app` mode.
- Verified one Budget Planner Save click sends exactly one write request, Edit opens on one click, and Delete sends exactly one delete request.
- Existing formulas changed: No.

### Phase 4A.2 UI Acceptance Expansion

- Hardened the pointer render gate with pointerup fallback release plus window/visibility cancellation paths.
- Expanded real-browser one-click coverage to Allocation Submit, Allocation Matrix edit/save/delete/export, Dashboard clear/export, Planner saved export, Report export, and representative tab navigation.
- Added network-request counting to verify one click does not duplicate critical write requests.
- Reproduced the Docker `npm ci` failure outside the Dockerfile and documented the corporate-CA/TLS build requirement.
- Existing formulas changed: No.

### Phase 4A.3 Acceptance Evidence

- Rechecked Render root/static/API routes read-only; the previous root timeout was not reproduced.
- Confirmed Render browser initialization without captured JavaScript exceptions or failed network events.
- Documented that Render is currently root-hosted because `/budget-app/*` returns `404`.
- Confirmed local startup with current `.env` is blocked by TiDB credential rejection; credentials were not changed or printed.
- Documented that Docker build remains blocked until the actual corporate CA is supplied through BuildKit `corp_ca`.
- Added the explicit Phase 4B gate: do not begin Phase 4B unless Phase 4A declarations are all `Yes` or externally waived.
- Existing formulas changed: No.
## Phase 4E

- Added Next FY Budget foundation with source snapshots, assumption rules, transactional generation, manual adjustments, workflow integration, summary/comparison APIs, frontend tab, tests, and documentation.

## Phase 5A - Authentication Foundation

- Added additive authentication/RBAC foundation migration `013_authentication_rbac_foundation.sql`.
- Added bcrypt password hashing, opaque hashed database sessions, HttpOnly cookie helpers, login/logout/me/change-password APIs, and bootstrap-admin CLI.
- Added validated auth environment settings and production/UAT session-secret requirements.
- Added Phase 5A tests and authentication architecture/runbook documentation.
- RBAC, location access enforcement, CSRF enforcement, and admin UI remain future Phase 5B-5F work.

## Phase 5A Operational Validation

- Added a safe migration runner and `migrate:auth` command for `013_authentication_rbac_foundation.sql`.
- Applied migration 013 to the configured development TiDB database and recorded it in `schema_migrations`.
- Verified existing Budget/Allocation record counts were preserved after migration.
- Fixed failed-login persistence so login attempts and lockout counters commit before safe public authentication errors are returned.
- Added Phase 5A UAT evidence in `docs/53-phase-5a-authentication-uat.md`.
