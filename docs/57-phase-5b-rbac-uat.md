# Phase 5B RBAC UAT Checklist

## Automated Evidence

| Area | Status | Evidence |
|---|---|---|
| Root base path | Automated | `npm run test:base-path` |
| Prefixed base path | Automated | `npm run test:base-path` |
| Nested base path | Automated | `npm run test:rbac` |
| Auth routes under prefix | Automated | `npm run test:base-path`, `npm run test:rbac` |
| RBAC routes under prefix | Automated | `npm run test:base-path`, `npm run test:rbac` |
| Cookie creation/clearing path | Automated | `npm run test:auth`, `npm run test:rbac` |
| RBAC seed idempotency | Automated | `npm run test:rbac` |
| Permission middleware | Automated | `npm run test:rbac` |

## Manual UAT Pending

Phase 5A bootstrap administrator creation remains pending. Until a real bootstrap admin exists, these Phase 5B flows cannot be completed manually:

- login as `SUPER_ADMIN`
- view RBAC role list through authenticated API
- assign roles to users
- change role-permission mappings
- verify browser cookie behavior after successful login

## Safe Commands

```bash
npm run seed:rbac
npm run test:rbac
npm run test:base-path
npm run test:auth
```

`npm run seed:rbac` is idempotent and should be run only against an approved development/UAT target after confirming secrets are local and ignored.

## Remaining Work

- Phase 5C: location authorization.
- Phase 5D: financial-module authorization.
- Phase 5F: login/admin frontend.
