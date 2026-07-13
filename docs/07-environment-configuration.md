# Environment Configuration

## Current Variables

Observed in `server.js`:

- `PORT`
- `APP_ENV`
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
- `DB_CONNECTION_LIMIT`
- `DB_CONNECT_TIMEOUT_MS`
- `LOG_LEVEL`
- `ENABLE_EXCEL_MIRROR`
- `ENABLE_GOOGLE_SHEETS_SYNC`
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
DB_CONNECTION_LIMIT=
DB_CONNECT_TIMEOUT_MS=
LOG_LEVEL=
ENABLE_EXCEL_MIRROR=
ENABLE_GOOGLE_SHEETS_SYNC=
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
