# Security Model

## Current State

No authentication or authorization exists.

Current security controls:

- SQL statements use parameterized queries in most active backend paths.
- JSON body size is limited to `10mb`.
- Phase 3.1 validates Development/UAT/Production configuration at startup.
- Phase 3.1 supports AWS Secrets Manager for DB credentials.
- Phase 3.1 restricts CORS by `ALLOWED_ORIGINS`.
- Phase 3.1 requires DB TLS in UAT and Production.

Current gaps:

- No login.
- No RBAC.
- No rate limiting.
- No security headers.
- No request IDs.
- No audit logs.
- Raw errors can be returned.
- Secrets exist in `.env`.
- Root database user may be used locally.

## Required Foundation

- Central config validation. Added in Phase 3.1.
- Restricted CORS by environment. Added in Phase 3.1.
- Security headers.
- Rate limiting.
- Request ID middleware.
- Central error handler.
- Validation middleware.
- Audit log table and write helper.
- Least-privilege DB user.
- AWS Secrets Manager compatibility. Added in Phase 3.1.
- TLS to RDS in UAT/Production. Enforced by Phase 3.1 configuration.

## Phase 3.1 Secret Handling

Database credentials are loaded server-side only. The app must not log DB passwords, usernames, hostnames, DB names, secret ARNs, raw AWS errors, or SQL details in public health responses.

`.env` remains ignored. Example env files contain placeholders only.

## Non-Negotiable Rule

Do not implement authorization only by hiding UI buttons. Backend must enforce all future permissions.
