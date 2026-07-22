# Enterprise API Design

## API Compatibility

Existing endpoints remain compatible. New workflow APIs should be additive and versioned under the existing base-path-aware API helper.

Suggested prefix:

```text
/api/workflows
/api/latest-estimates
/api/next-fy-budgets
/api/transfers
/api/variance
/api/notifications
/api/audit
```

## Workflow APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/workflows/:entityType/:entityId` | Read workflow instance and history. |
| `POST` | `/api/workflows/:entityType/:entityId/actions/submit` | Submit current entity. |
| `POST` | `/api/workflows/:entityType/:entityId/actions/start-review` | Move submitted budget to review. |
| `POST` | `/api/workflows/:entityType/:entityId/actions/return` | Return with mandatory remarks. |
| `POST` | `/api/workflows/:entityType/:entityId/actions/approve` | Approve entity. |
| `POST` | `/api/workflows/:entityType/:entityId/actions/lock` | Lock entity. |

## LE Matrix APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/latest-estimates/matrices` | List LE matrices with filters. |
| `POST` | `/api/latest-estimates/matrices` | Create draft LE matrix. |
| `GET` | `/api/latest-estimates/matrices/:id/cells` | Server-side paged grid cells. |
| `PUT` | `/api/latest-estimates/matrices/:id/cells/:cellId` | Update one LE cell. |
| `POST` | `/api/latest-estimates/matrices/:id/cells/bulk` | Bulk update cells transactionally. |
| `POST` | `/api/latest-estimates/matrices/:id/validate` | Run variance validation. |
| `POST` | `/api/latest-estimates/matrices/:id/submit` | Submit LE matrix. |
| `POST` | `/api/latest-estimates/matrices/:id/approve` | Approve LE matrix. |

## Variance APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/variance` | List open variance exceptions. |
| `POST` | `/api/variance/:id/confirm` | Confirm exception with remarks. |
| `POST` | `/api/variance/:id/approve` | Approve exception. |

## Next FY APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/next-fy-budgets/generate` | Generate next FY draft from approved LE. |
| `GET` | `/api/next-fy-budgets/:id/lines` | Read paged next FY rows. |
| `PUT` | `/api/next-fy-budgets/:id/lines/:lineId` | Manual line adjustment. |
| `POST` | `/api/next-fy-budgets/:id/bulk-adjust` | Bulk adjustment. |
| `POST` | `/api/next-fy-budgets/:id/review` | Mark reviewed. |
| `POST` | `/api/next-fy-budgets/:id/approve` | Approve. |
| `POST` | `/api/next-fy-budgets/:id/lock` | Final lock. |

## Transfer APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/transfers` | List transfers. |
| `POST` | `/api/transfers` | Create draft transfer. |
| `PUT` | `/api/transfers/:id` | Edit draft transfer. |
| `POST` | `/api/transfers/:id/submit` | Submit. |
| `POST` | `/api/transfers/:id/approve` | Approve. |
| `POST` | `/api/transfers/:id/post` | Post ledger transaction. |
| `POST` | `/api/transfers/:id/reverse` | Create reversal. |

## Permission Boundary Names

These are design-time boundaries only. Authentication/RBAC is not implemented in this phase.

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

## Error Contract

New APIs must use the existing Phase 3.2 error envelope and request ID behavior. New public codes should include:

- `INVALID_WORKFLOW_TRANSITION`
- `ENTITY_LOCKED`
- `VARIANCE_REMARKS_REQUIRED`
- `TRANSFER_VALIDATION_FAILED`
- `BULK_OPERATION_PARTIAL_FAILURE`
