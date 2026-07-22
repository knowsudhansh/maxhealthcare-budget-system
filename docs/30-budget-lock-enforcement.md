# Budget Lock Enforcement

Phase 4C implements controlled edit/delete restrictions behind a feature flag.

## Feature Flag

`WORKFLOW_LOCK_ENFORCEMENT_ENABLED=false` by default.

When disabled:

- Budget Planner edit/delete behavior remains backward-compatible.
- Workflow state, warnings, and history are visible.
- No hard Planner lock is enforced.

When enabled:

- Backend checks the Budget workflow before Budget Planner edit/delete writes.
- `DRAFT` records remain editable and deletable.
- `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, and `LOCKED` records reject edit/delete writes.
- Legacy records with no workflow preserve current behavior unless a future policy changes it.

## Backend Error Codes

- `BUDGET_WORKFLOW_EDIT_RESTRICTED`
- `BUDGET_WORKFLOW_DELETE_RESTRICTED`
- `BUDGET_WORKFLOW_LOCKED`
- `WORKFLOW_STATE_REQUIRES_DRAFT`

Responses remain sanitized and include request IDs. SQL and internal details must not be exposed.

## Rollout

Stage 1: actions enabled, enforcement disabled.

Stage 2: UAT review of warnings and approval flow.

Stage 3: enable backend enforcement only after UAT approval.

## Rollback

Set `WORKFLOW_LOCK_ENFORCEMENT_ENABLED=false` and restart the service. No financial data rollback is required because enforcement does not change formulas or amount values.
