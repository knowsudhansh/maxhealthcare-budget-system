# Environment Configuration

## Current Variables

Observed in `server.js`:

- `PORT`
- `APP_ENV`
- `APP_BASE_PATH`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`
- `AWS_REGION`
- `DB_SECRET_ARN`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL`
- `DB_SSL_CA`
- `DB_CONNECTION_LIMIT`
- `DB_CONNECT_TIMEOUT_MS`
- `LOG_LEVEL`
- `ENABLE_EXCEL_MIRROR`
- `ENABLE_GOOGLE_SHEETS_SYNC`
- `WORKFLOW_FOUNDATION_ENABLED`
- Legacy local aliases still supported: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TAB`

Observed in frontend:

- `localStorage.API_BASE_OVERRIDE`
- Hard-coded hosted fallback URL.

## Current Risk

The current `.env` contains real local credentials and commented Railway credentials. Secrets must not be committed.

Phase 3.1 adds startup validation, AWS Secrets Manager compatibility, production guardrails, and CORS origin allowlisting.

## Required Examples

Create these before deployment:

- `.env.example`
- `.env.development.example`
- `.env.uat.example`
- `.env.production.example`

Suggested variables:

```env
APP_ENV=
PORT=
APP_BASE_PATH=
FRONTEND_URL=
ALLOWED_ORIGINS=
AWS_REGION=
DB_SECRET_ARN=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_SSL=
DB_SSL_CA=
DB_CONNECTION_LIMIT=
DB_CONNECT_TIMEOUT_MS=
LOG_LEVEL=
ENABLE_EXCEL_MIRROR=
ENABLE_GOOGLE_SHEETS_SYNC=
WORKFLOW_FOUNDATION_ENABLED=
```

## Phase 3.1 Configuration Loader

Runtime configuration is loaded by `src/config/environment.js`.

Startup fails before the HTTP server starts when required variables are missing or unsafe for the selected environment.

Development:

- May use direct `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`.
- May set `DB_SSL=false`.
- May use localhost origins.

UAT and Production:

- Prefer `DB_SECRET_ARN` plus `AWS_REGION`.
- Require `DB_SSL=true`.
- Must not use a localhost database host.
- Must not use wildcard CORS.
- Must not mix UAT and Production secret names.

`ENABLE_EXCEL_MIRROR` and `ENABLE_GOOGLE_SHEETS_SYNC` default to `true` to preserve current behavior unless explicitly disabled.

`WORKFLOW_FOUNDATION_ENABLED` defaults to `true` for Phase 4B shadow workflow status and additive workflow APIs. It does not enable authentication, RBAC, or Planner lock enforcement.

## TiDB Cloud Starter Demo Configuration

TiDB Cloud Starter is MySQL-compatible and uses the existing `mysql2/promise` database path.

Temporary shared-demo local `.env` values should use environment variables only:

```env
APP_ENV=development
PORT=3001
DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=<TIDB_USERNAME>
DB_PASSWORD=<TIDB_PASSWORD>
DB_NAME=budget_app
DB_SSL=true
DB_SSL_CA=./certs/tidb-ca.pem
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
ENABLE_EXCEL_MIRROR=false
ENABLE_GOOGLE_SHEETS_SYNC=false
```

`DB_SSL_CA` is a filesystem path, not certificate contents. Relative paths are resolved from the project root. The CA file is read once during startup and passed to `mysql2` as verified TLS.

`DB_*` names are authoritative. Legacy `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` may be used only as a temporary fallback. If both `DB_*` and the matching `MYSQL_*` variable are present and differ, startup fails with `DB_CONFIG_CONFLICT`. Warnings name only the deprecated variable names and never print values.

Never commit `.env`, `.env.docker`, TiDB passwords, CA certificates, or secret files.

## Base Path

`APP_BASE_PATH` controls the public deployment prefix.

Valid examples:

- empty value -> root mode
- `/` -> root mode
- `budget-app` -> `/budget-app`
- `/budget-app/` -> `/budget-app`

Invalid values are rejected when they contain protocols, query strings, fragments, backslashes, traversal segments, or unsupported path characters.

UAT and Production examples use:

```env
APP_BASE_PATH=/budget-app
```

The frontend receives only:

```javascript
window.APP_CONFIG = {
  basePath: "/budget-app",
  appBasePath: "/budget-app",
  apiBasePath: "/budget-app/api"
};
```

No database or AWS secrets are exposed through this endpoint.

Phase 4A keeps both root and path-based modes active. Frontend API calls must continue to use the runtime URL helper instead of hardcoded root paths.

Phase 5B derives `apiBasePath` from `APP_BASE_PATH`; there is no separate `API_BASE_PATH` environment variable. This prevents mismatched route prefixes and cookie scopes.

## Secrets Manager Boundary

`src/config/secrets.js` loads DB credentials once and caches the normalized result in memory. It accepts secret JSON fields:

- `host`
- `port`
- `dbname` or `database`
- `username` or `user`
- `password`
- `ssl`

Secrets are never logged. The frontend never receives DB credentials.

## Protection Rules Needed

- Production must not start when database secret contains `uat`, `test`, or `development`.
- UAT must not use production database secret.
- Production must not use localhost DB settings.
- Production must not allow wildcard CORS.
- Production must require TLS to database.
- Secrets must be read from AWS Secrets Manager for UAT/Production.

## Workflow Rollout Flags

```env
WORKFLOW_FOUNDATION_ENABLED=true
WORKFLOW_ACTIONS_ENABLED=true
WORKFLOW_APPROVAL_QUEUE_ENABLED=true
WORKFLOW_LOCK_ENFORCEMENT_ENABLED=false
```

`WORKFLOW_LOCK_ENFORCEMENT_ENABLED=false` is the safe default. It leaves Planner edit/delete behavior backward-compatible while allowing workflow actions and UAT review.

Setting `WORKFLOW_LOCK_ENFORCEMENT_ENABLED=true` activates backend edit/delete restrictions for submitted, under-review, approved, and locked Budget workflows. This must not be enabled before UAT approval.
## Phase 4E Next FY Feature Flags

- `NEXT_FY_BUDGET_ENABLED=true`
- `NEXT_FY_WORKFLOW_ENFORCEMENT_ENABLED=true`
- `NEXT_FY_ALLOW_LEGACY_SOURCE=false`
- `NEXT_FY_ALLOW_MANUAL_BASELINE=false`
- `NEXT_FY_ALLOW_GENERATION_RESET=false`
- `NEXT_FY_DEFAULT_GROWTH_PERCENT=0`
- `NEXT_FY_MAX_GROWTH_PERCENT=100`
- `NEXT_FY_MIN_GROWTH_PERCENT=-100`
- `NEXT_FY_MAX_ABSOLUTE_AMOUNT=10000000000`
- `NEXT_FY_MAX_BULK_LINES=500`

Only safe booleans are exposed through `app-config.js`. Secrets and database connection settings are never exposed to the browser.

## Authentication Environment

Phase 5A adds validated authentication configuration:

```text
AUTH_SESSION_SECRET
AUTH_SESSION_TTL_MINUTES
AUTH_IDLE_TIMEOUT_MINUTES
AUTH_COOKIE_NAME
AUTH_COOKIE_SECURE
AUTH_COOKIE_SAME_SITE
AUTH_MAX_LOGIN_ATTEMPTS
AUTH_LOCKOUT_MINUTES
AUTH_PASSWORD_MIN_LENGTH
AUTH_TRUST_PROXY
CSRF_ENABLED
```

`AUTH_SESSION_SECRET` must be at least 32 characters in UAT and Production. It must never be committed or printed. `AUTH_COOKIE_SECURE=true` is required when `AUTH_COOKIE_SAME_SITE=None`.

The session cookie path follows `APP_BASE_PATH`:

- root mode -> `/`
- `/budget` -> `/budget`
- `/apps/it-opex` -> `/apps/it-opex`

Cookie creation and clearing must use the same path.

## Phase 5B RBAC Commands

```bash
npm run seed:rbac
npm run test:rbac
```

`seed:rbac` is idempotent and must be run only against an approved development/UAT target. It does not create users or credentials.

Phase 5C adds location permissions to the RBAC registry. Rerun `npm run seed:rbac` in approved development/UAT after deployment so the registry contains:

- `location.view`
- `location.create`
- `location.update`
- `location.disable`
- `location.assign`
- `location.view_assignments`
- `location.access_all`

`npm run location:analyze-existing` is read-only and reports current descriptive location values without changing records.
