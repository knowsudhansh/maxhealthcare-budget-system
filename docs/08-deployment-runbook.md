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
docker compose -f docker-compose.example.yml up --build
```

The image:

- uses `node:22-alpine`,
- installs production dependencies with `npm ci --omit=dev`,
- runs as the non-root `node` user,
- exposes port `3000`,
- uses `/health/ready` as the container health check,
- keeps `.env`, Google service-account files, logs, `node_modules`, and local `Server data` out of the build context.

The compose file disables Excel and Google Sheets mirrors by default for local container trials. UAT/Production values should come from the environment or AWS runtime configuration, not from committed files.

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
