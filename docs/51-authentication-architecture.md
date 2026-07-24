# Phase 5A Authentication Architecture

Phase 5A introduces the server-side authentication foundation for the MAX Healthcare IT OPEX Budget Management System.

## Selected Architecture

The application uses server-side sessions with opaque random session tokens in secure HttpOnly cookies.

Flow:

```text
Login identifier + password
-> server-side password verification
-> random session token
-> SHA-256 HMAC token hash stored in user_sessions
-> HttpOnly cookie returned to browser
-> /api/auth/me resolves user context from the database session
```

Session tokens are never stored in `localStorage`, never returned in JSON, and are stored in the database only as hashes.

## Phase 5A Scope

Implemented:

- additive authentication/RBAC schema migration
- `users`, `roles`, `permissions`, role/location assignment tables
- `user_sessions`, `login_attempts`, `security_audit_events`
- bcrypt password hashing
- login, logout, current-user, and change-password endpoints
- account lockout counters
- password policy validation
- bootstrap-admin CLI
- HttpOnly session cookies

Not yet implemented:

- RBAC enforcement
- location-scoped financial queries
- admin UI
- CSRF enforcement
- SSO/MFA
- module authorization integration

## Security Rules

- Passwords must never be stored or logged in plaintext.
- Browser-supplied user IDs, roles, permissions, locations, and approval rights are not authoritative.
- Session cookies must be HttpOnly.
- UAT and Production require `AUTH_SESSION_SECRET` with at least 32 characters.
- Existing business owner fields such as `owner` and `owner1` are not authenticated user identities.

## Phase 5B Entry Point

Phase 5B should attach roles to permissions and add `requirePermission` middleware. It must continue using the session principal from Phase 5A.
