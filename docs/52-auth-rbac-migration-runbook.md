# Auth/RBAC Migration Runbook

Migration:

```text
migrations/013_authentication_rbac_foundation.sql
```

The migration is additive. It creates authentication, session, RBAC, location-access, login-attempt, and security-audit tables. It does not modify financial tables.

## Deployment Steps

1. Back up the target database.
2. Confirm `.env`, certificates, and secrets are not committed.
3. Apply `013_authentication_rbac_foundation.sql` only after approval.
4. Set required auth environment variables.
5. Restart the application.
6. Run `npm run auth:bootstrap-admin` only if no users exist.
7. Run `npm run test:auth`.

## Bootstrap Admin

Command:

```bash
npm run auth:bootstrap-admin
```

The script prompts for employee ID, email, display name, and temporary password. The password prompt is muted. The created user must change password after first login.

Do not create default `admin/admin` credentials.

## Rollback

Rollback is allowed only in isolated non-production environments after confirming no authentication data must be retained. Use the rollback guidance comments at the bottom of the migration.

## Migration Runner

Phase 5A operational validation added a safe migration runner:

```bash
npm run migrate:auth
```

The runner:

- refuses `APP_ENV=production` unless explicitly overridden,
- allows only development/UAT targets for normal use,
- blocks destructive migration statements before rollback guidance,
- creates `schema_migrations`,
- records the migration checksum,
- safely reports whether a migration was newly applied or already recorded.

## Phase 5A UAT Status

See `docs/53-phase-5a-authentication-uat.md` for the development TiDB validation evidence, blocked bootstrap scenarios, and failed-login persistence fix.
