# Security Model

## Current State

No authentication or authorization exists.

Current security controls:

- SQL statements use parameterized queries in most active backend paths.
- JSON body size is limited to `10mb`.

Current gaps:

- Wildcard CORS.
- No login.
- No RBAC.
- No rate limiting.
- No security headers.
- No request IDs.
- No audit logs.
- Raw errors can be returned.
- Secrets exist in `.env`.
- Production/UAT separation missing.
- No TLS enforcement to DB.
- Root database user may be used locally.

## Required Foundation

- Central config validation.
- Restricted CORS by environment.
- Security headers.
- Rate limiting.
- Request ID middleware.
- Central error handler.
- Validation middleware.
- Audit log table and write helper.
- Least-privilege DB user.
- AWS Secrets Manager.
- TLS to RDS in UAT/Production.

## Non-Negotiable Rule

Do not implement authorization only by hiding UI buttons. Backend must enforce all future permissions.

