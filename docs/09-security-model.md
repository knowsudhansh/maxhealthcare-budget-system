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

## Phase 3.2 Security Foundation

- Every request receives an `X-Request-ID`.
- Write errors use safe public responses.
- Structured request/error logs include request ID, method, path, status code, duration, and public error code.
- Logs must not include credentials, cookies, Authorization headers, DB secrets, AWS credentials, or full sensitive payloads.
- Audit events redact sensitive fields before persistence.

Authentication, RBAC, and chatbot access controls are still not implemented.

## Base-Path Runtime Config Security

`/app-config.js` exposes only:

```javascript
window.APP_CONFIG = { basePath: "..." };
```

It must never expose database hosts, usernames, passwords, AWS secret ARNs, tokens, service-account data, cookies, or credentials.

Static serving is restricted to approved frontend assets. `.env`, `node_modules`, migrations, tests, service-account files, certificates, keys, logs, and `Server data` must not be served as static files.

## TiDB Demo Secret Handling

TiDB credentials and CA files are local runtime inputs only.

- Do not commit `.env`, `.env.docker`, TiDB passwords, or files under `certs/*.pem`, `certs/*.crt`, or `certs/*.cer`.
- `DB_SSL=true` requires `DB_SSL_CA`.
- TLS certificate verification must remain enabled with `rejectUnauthorized: true`.
- Do not use `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, or disabled npm TLS verification.
- Health endpoints and verification scripts must not print passwords, usernames, CA contents, CA paths, or connection strings.

## Non-Negotiable Rule

Do not implement authorization only by hiding UI buttons. Backend must enforce all future permissions.
