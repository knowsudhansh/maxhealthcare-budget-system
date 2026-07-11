# Deployment Runbook

## Current Local Run

```powershell
npm install
npm start
```

Server uses `PORT` from `.env`; current local `.env` uses `3001`.

Open:

```text
http://localhost:3001
```

or open `index.html` directly, but backend API calls still need the server running.

## Current Health Check

```text
GET /api/health
```

Returns server status and MySQL connectivity.

## UAT Target

- AWS-hosted backend.
- Amazon RDS MySQL 8 in private subnets.
- Separate UAT database.
- AWS Secrets Manager for DB credentials.
- Restricted UAT CORS origins.
- TLS for DB.
- CloudWatch logs.

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

- No environment validation.
- No AWS Secrets Manager module.
- No migrations.
- No centralized logging or request IDs.
- No production-safe error handler.
- No authentication or RBAC.
- No transaction wrapper for allocation operations.

## Rollback Guidance

Until migrations and deployment automation exist:

- Back up MySQL before schema changes.
- Back up `server data/it-opex-budget-submissions.xlsx`.
- Tag code before UAT/Production deployments.
- Keep prior server artifact available.
- Verify `/api/health`, `/api/budget-data`, `/api/allocation-data`, `/api/allocation-matrix` after rollback.

