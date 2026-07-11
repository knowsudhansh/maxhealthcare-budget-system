# Environment Configuration

## Current Variables

Observed in `server.js`:

- `PORT`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TAB`

Observed in frontend:

- `localStorage.API_BASE_OVERRIDE`
- Hard-coded hosted fallback URL.

## Current Risk

The current `.env` contains real local credentials and commented Railway credentials. Secrets must not be committed.

CORS is wildcard and environment-independent.

There is no `APP_ENV`, no startup validation, no AWS Secrets Manager, no production guardrails, and no CORS origin allowlist.

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
API_BASE_URL=
ALLOWED_ORIGINS=
AWS_REGION=
DB_SECRET_ARN=
DB_CONNECTION_LIMIT=
DB_SSL=
LOG_LEVEL=
GOOGLE_SHEET_ID=
GOOGLE_SHEET_TAB=
```

## Protection Rules Needed

- Production must not start when database secret contains `uat`, `test`, or `development`.
- UAT must not use production database secret.
- Production must not use localhost DB settings.
- Production must not allow wildcard CORS.
- Production must require TLS to database.
- Secrets must be read from AWS Secrets Manager for UAT/Production.

