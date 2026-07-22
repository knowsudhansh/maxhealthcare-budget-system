# Budget Workflow Actions

Phase 4C makes the existing Budget workflow usable while keeping authentication and RBAC out of scope.

## Enabled Scope

- Legacy Budget Planner rows can start a Budget workflow in `DRAFT`.
- Existing workflow rows expose available actions from the backend state machine.
- State changes happen only through `POST /api/workflows/:workflowId/transitions`.
- Every transition sends `action`, `expectedVersion`, `remarks`, and `idempotencyKey`.
- Workflow history and audit integration remain transaction-bound.

## Action Mapping

| State | Available Action | Next State | Remarks |
|---|---|---|---|
| Not Started | Start Workflow | DRAFT | Optional |
| DRAFT | Submit for Review | SUBMITTED | Optional |
| SUBMITTED | Start Review | UNDER_REVIEW | Optional |
| SUBMITTED | Return to Draft | DRAFT | Required |
| SUBMITTED | Reject | DRAFT | Required |
| UNDER_REVIEW | Approve | APPROVED | Optional |
| UNDER_REVIEW | Return to Draft | DRAFT | Required |
| APPROVED | Lock | LOCKED | Required |
| LOCKED | None | LOCKED | N/A |

Action availability is returned by the backend and only rendered by the frontend. The UI must not become the source of truth for valid transitions.

## Permission Boundaries

Permissions are defined for future RBAC only and are not enforced in Phase 4C:

- `budget.workflow.start`
- `budget.submit`
- `budget.review.start`
- `budget.approve`
- `budget.return_to_draft`
- `budget.reject`
- `budget.lock`
- `budget.workflow.view`
- `budget.workflow.history.view`
- `budget.approval_queue.view`

## Notification Events

Phase 4C emits internal notification event metadata for workflow transitions only. Email/SMS delivery is not implemented.

- `BUDGET_SUBMITTED`
- `BUDGET_REVIEW_STARTED`
- `BUDGET_APPROVED`
- `BUDGET_RETURNED_TO_DRAFT`
- `BUDGET_REJECTED`
- `BUDGET_LOCKED`

## Formula Boundary

Workflow actions do not alter budget, allocation, utilization, comparison, dashboard, or Indian formatting formulas.
