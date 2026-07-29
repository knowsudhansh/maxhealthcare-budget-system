# Phase 5A Authentication UAT

Date: 2026-07-29

Environment: development TiDB database `budget_app`

## Scope

This UAT validates the existing Phase 5A authentication foundation against the configured development TiDB database.

Out of scope:

- RBAC enforcement
- location-based financial data restrictions
- login UI
- CSRF enforcement
- admin UI
- protection of existing financial APIs

## Migration Status

Migration applied:

```text
migrations/013_authentication_rbac_foundation.sql
```

Command:

```bash
npm run migrate:auth
```

Result:

```text
applied: true
recorded: true
statementCount: 11
```

Second run result:

```text
applied: false
recorded: true
```

The runner records migrations in `schema_migrations`.

## Business Data Counts

| Table | Before | After |
|---|---:|---:|
| `budget_submissions` | 27 | 27 |
| `allocation_records` | 4 | 4 |
| `allocation_matrix` | 4 | 4 |
| `allocation_location_map` | 19 | 19 |

No existing business record count decreased.

## Auth Tables Verified

Verified present:

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `locations`
- `user_locations`
- `user_sessions`
- `login_attempts`
- `security_audit_events`
- `password_history`
- `schema_migrations`

Primary and unique constraints plus indexes were verified through database metadata. Migration 013 does not currently define foreign-key constraints; this is recorded as a schema limitation for a future additive migration review.

## API UAT Results

| Scenario | Result |
|---|---|
| `GET /api/auth/me` without session | Pass: 401 `AUTHENTICATION_REQUIRED` |
| Unknown employee ID login | Pass: 401 `INVALID_CREDENTIALS` |
| Unknown email login | Pass: 401 `INVALID_CREDENTIALS` |
| Password/hash exposure in failed responses | Pass: not exposed |
| Session cookie on failed login | Pass: not set |
| Failed-login persistence | Pass after fix: `login_attempts` rows persisted |

## Blocked Scenarios

Bootstrap administrator creation was not completed because no safe bootstrap employee ID, email, display name, and non-logged password were supplied for the development TiDB database.

The following scenarios remain blocked until bootstrap is completed:

- successful login by employee ID
- successful login by email
- valid-session `/api/auth/me`
- logout with valid session
- password change
- old password rejection after password change
- new password login after password change
- session revocation after password change
- lockout for an existing user
- login/logout/password-change audit-event validation

## Defect Found And Fixed

Finding:

Failed-login attempts and lockout counters were written inside a transaction and then rolled back when the service threw the public authentication error.

Fix:

The login service now commits failed-attempt records and lockout state, then throws the safe public auth error after commit.

## Security Notes

- No passwords, session cookies, session token hashes, database passwords, or certificate contents were included in this document.
- Failed credential responses remain generic.
- Raw session token storage was not observed.
- Development does not require `AUTH_SESSION_SECRET`; UAT and Production do.

## Phase 5B Gate

Phase 5B should not begin until bootstrap administrator creation and successful-login UAT are completed, or the project owner explicitly accepts those as pending operational tasks.
