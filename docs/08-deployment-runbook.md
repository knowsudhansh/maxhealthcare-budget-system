# Deployment Runbook

## Current Local Run

```powershell
npm install
npm start
```

Server requires `APP_ENV` and database configuration. For local development, copy `.env.development.example` to `.env` and fill only local credentials.

The current local `.env` is intentionally not committed and should not be copied into documentation or source control.

Open:

```text
http://localhost:3001
```

or open `index.html` directly, but backend API calls still need the server running.

## Docker Local Run

Phase 3.2A adds container packaging only. It does not provision AWS resources or modify any database.

Build the image:

```powershell
docker build -t max-it-opex-budget-app:local .
```

Run with an existing local `.env`:

```powershell
docker run --rm `
  --env-file .env `
  -e PORT=3000 `
  -e APP_ENV=development `
  -e ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001 `
  -p 3001:3000 `
  -v "budget-app-data:/app/Server data" `
  max-it-opex-budget-app:local
```

Or use the example compose file:

```powershell
docker compose -f compose.yaml up --build
```

The image:

- uses `node:22-alpine`,
- installs production dependencies with `npm ci --omit=dev`,
- runs as the non-root `node` user,
- exposes port `3000`,
- uses `/health/ready` as the container health check,
- keeps `.env`, Google service-account files, logs, `node_modules`, and local `Server data` out of the build context.

The compose file disables Excel and Google Sheets mirrors by default for local container trials. UAT/Production values should come from the environment or AWS runtime configuration, not from committed files.

To test the public prefix locally:

```powershell
$env:APP_BASE_PATH="/budget-app"
docker compose -f compose.yaml up --build
```

Then open:

```text
http://127.0.0.1:3001/budget-app/
```

## Current Health Check

```text
GET /api/health
```

Compatibility health check. Database details are sanitized.

Preferred runtime checks:

```text
GET /health/live
GET /health/ready
```

Readiness returns `503` until the singleton MySQL pool can run `SELECT 1`.

## Startup Order

1. Load and validate environment configuration.
2. Load DB credentials directly or once from AWS Secrets Manager.
3. Create the singleton MySQL connection pool.
4. Run startup `SELECT 1`.
5. Start the HTTP server.

The backend must not accept traffic before database readiness succeeds.

## Graceful Shutdown

The process handles `SIGTERM` and `SIGINT`.

Shutdown flow:

1. Stop accepting new HTTP connections.
2. Close the HTTP server.
3. Close the MySQL pool.
4. Exit cleanly.

A bounded timeout prevents shutdown from hanging indefinitely.

## UAT Target

- AWS-hosted backend.
- Amazon RDS MySQL 8 in private subnets.
- Separate UAT database.
- AWS Secrets Manager for DB credentials.
- Restricted UAT CORS origins.
- TLS for DB.
- CloudWatch logs.

Phase 3.1 prepares the application for this target but does not provision AWS resources.
Phase 3.2A prepares a Docker image for a future AWS container runtime but does not push images or create AWS infrastructure.

## AWS ALB Path-Based Hosting

Target public URL:

```text
https://<domain>/budget-app/
```

Application environment:

```env
APP_BASE_PATH=/budget-app
```

ALB listener rule:

- Path conditions:
  - `/budget-app`
  - `/budget-app/*`
- Action: forward to the budget-app target group.

Target group:

- Protocol: HTTP
- Application port: `3000`
- Health check path: `/health/ready`
- Success code: `200`

The ALB forwards the original request path. The application handles `APP_BASE_PATH`; the ALB should not strip or rewrite the prefix.

## TiDB Cloud Starter Temporary Demo

TiDB is supported only as a temporary shared demo database for the meeting. It is not final production database approval.

1. Put TiDB credentials in local `.env` only.
2. Put the CA file at `certs/tidb-ca.pem`.
3. Verify `.env` and certificate files are ignored by Git.
4. Apply `migrations/008_tidb_demo_schema.sql` manually to the `budget_app` database if required.
5. Verify connectivity and schema:

```powershell
npm run verify:tidb
```

Expected safe output:

```text
TiDB connection: OK
TLS verification: OK
Database: budget_app
Required schema: OK
Planner records: <count>
```

Seed demo records only when explicitly needed:

```powershell
npm run seed:tidb-demo
```

The seed is manual, idempotent, transactional, and does not run during app startup. The current approved demo seed uses marker `TIDB_DEMO_SEED_V2` and exactly 20 coding values:

```text
ITOPEX005, ITOPEX007, ITOPEX008, ITOPEX009, ITOPEX011,
ITOPEX013, ITOPEX014, ITOPEX015, ITOPEX018, ITOPEX023,
ITOPEX024, ITOPEX029, ITOPEX032, ITOPEX033, ITOPEX034,
ITOPEX035, ITOPEX036, ITOPEX037, ITOPEX038, ITOPEX042
```

The seed updates only rows carrying the V2 marker and removes only old deterministic demo rows carrying the old marker. It must not delete manually entered records based only on coding. See `docs/18-tidb-demo-seed.md` for the approved mapping, amount strategy, and Owner versus Owner1 boundary.

TiDB Cloud Starter free-tier limits may throttle or pause the instance. Production migration requires separate review.

## Production Target

- Separate AWS account or at least separate VPC/RDS/secrets from UAT.
- RDS encrypted at rest.
- Automated backups enabled.
- Multi-AZ considered for production.
- TLS required.
- No root DB user.
- Restricted CORS.
- No stack traces to users.

## Current Deployment Blockers

- No migrations.
- No authentication or RBAC.
- Container image has not yet been deployed to UAT.

## Rollback Guidance

Until migrations and deployment automation exist:

- Back up MySQL before schema changes.
- Back up `server data/it-opex-budget-submissions.xlsx`.
- Tag code before UAT/Production deployments.
- Keep prior server artifact available.
- Verify `/api/health`, `/api/budget-data`, `/api/allocation-data`, `/api/allocation-matrix` after rollback.
