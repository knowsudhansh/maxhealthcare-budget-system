# Future RBAC Design

RBAC is not implemented in current code. This document is a boundary for future work only.

## Future Roles

- `SUPER_ADMIN`
- `BUDGET_ADMIN`
- `CORPORATE_VIEWER`
- `LOCATION_MANAGER`
- `LOCATION_EDITOR`
- `AUDITOR`
- `REPORT_VIEWER`
- `CHATBOT_USER`

## Future Tables

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `user_location_access`
- `audit_logs`

## Permission Areas

- Dashboard view.
- Planner create/edit/delete.
- Allocation create/edit/delete.
- Utilization view.
- Comparison view.
- Report export.
- Location-level access.
- Admin configuration.
- Chatbot query access.

## Workflow Permission Boundaries

These permission names are design boundaries only. Authentication and active RBAC enforcement are not implemented.

- `budget.create`
- `budget.edit`
- `budget.submit`
- `budget.review`
- `budget.approve`
- `budget.lock`
- `le.create`
- `le.edit`
- `le.bulk_update`
- `le.validate`
- `le.submit`
- `le.approve`
- `nextfy.generate`
- `nextfy.adjust`
- `nextfy.review`
- `nextfy.approve`
- `nextfy.lock`
- `transfer.create`
- `transfer.submit`
- `transfer.approve`
- `transfer.post`
- `transfer.reverse`
- `notification.read`
- `audit.view`
- `report.export`

## Enforcement Rule

The backend must resolve the authenticated user's allowed locations and add those restrictions to every relevant database query.

Never trust a location, role, or permission supplied by the frontend as proof of access.

## Current Preparation Need

Before implementing RBAC:

- Add authentication.
- Add request context with user id.
- Add audit logging.
- Move location list to master table/API.
- Add query filters by authorized location.
