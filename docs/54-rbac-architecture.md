# Phase 5B RBAC Architecture

Phase 5B adds enterprise role and permission authorization on top of the Phase 5A session foundation.

## Boundary

Implemented:

- database-backed role registry
- database-backed permission registry
- role-permission mappings
- user-role assignments
- effective permission resolution from trusted server-side sessions
- reusable authorization middleware
- protected RBAC administration APIs
- authorization audit events for RBAC changes and blocked sensitive changes

Not implemented in Phase 5B:

- location authorization
- financial-module authorization across all legacy APIs
- login/admin frontend
- CSRF enforcement
- final Phase 5F admin console

## Trusted Context

Authorization is resolved only from:

```text
validated session cookie
-> user_sessions
-> users
-> user_roles
-> roles
-> role_permissions
-> permissions
```

The browser must never supply authoritative roles, permissions, actor IDs, or assignment metadata.

## Middleware

- `requireAuthentication` returns `401` when no valid session exists.
- `requirePermission(code)` returns `403` when a valid session lacks the required permission.
- `requireAnyPermission(codes)` allows at least one known permission.
- `requireAllPermissions(codes)` requires every known permission.

Unknown permission codes are rejected during middleware construction so route protection fails closed.

## Session Context

`req.auth` contains:

- `user`
- `sessionId`
- `roles`
- `permissions`

It never contains password hashes, raw session tokens, token hashes, database secrets, or cookies.

## Known Limitation

Migration `013` does not include role/permission active-status columns. Phase 5B respects `users.status` and `user_roles.valid_from/valid_until`. Role and permission active-state controls require a future additive migration if the business approves that capability.
