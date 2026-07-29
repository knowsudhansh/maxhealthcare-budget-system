# Phase 5B Role Permission Matrix

The RBAC seed is idempotent and non-destructive. It inserts or updates only known system roles, known permissions, and their mappings. It does not delete custom roles or unknown future permissions.

## Roles

- `SUPER_ADMIN`
- `FINANCE_ADMIN`
- `BUDGET_ADMIN`
- `LOCATION_FINANCE_USER`
- `BUDGET_SUBMITTER`
- `BUDGET_APPROVER`
- `TRANSFER_REQUESTER`
- `TRANSFER_APPROVER`
- `REPORT_VIEWER`
- `AUDITOR`

## Permission Registry

Permission codes are lower-case, module-scoped, and stable, for example:

- `planner.view`
- `planner.create`
- `planner.update`
- `planner.delete`
- `workflow.approve`
- `transfer.post`
- `role.assign_permission`
- `user.assign_role`
- `security.manage`

The complete registry lives in `src/modules/rbac/rbac.constants.js`.

## Matrix Summary

- `SUPER_ADMIN`: all seeded permissions.
- `FINANCE_ADMIN`: finance, budget, workflow, LE, Next FY, transfer, report, and selected user/role visibility.
- `BUDGET_ADMIN`: planner, allocation, LE, Next FY, transfer operations, reports, and workflow submit.
- `LOCATION_FINANCE_USER`: dashboard and read/update-oriented finance operations; location scoping is Phase 5C.
- `BUDGET_SUBMITTER`: planner create/update/submit and workflow submit.
- `BUDGET_APPROVER`: planner/workflow approval and rejection.
- `TRANSFER_REQUESTER`: transfer create/update/submit/cancel.
- `TRANSFER_APPROVER`: transfer approve/reject/post.
- `REPORT_VIEWER`: dashboard, report view, and report export.
- `AUDITOR`: read-only dashboard, workflow, transfer, report, and audit access.

## Guardrails

- Do not grant permissions by role-name checks in controllers.
- Do not trust client-supplied permissions.
- Do not remove unknown custom roles during seed.
- Do not assign `SUPER_ADMIN` unless the acting user is already `SUPER_ADMIN`.
- Do not remove the final active `SUPER_ADMIN`.
