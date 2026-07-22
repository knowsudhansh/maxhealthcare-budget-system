# Workflow Foundation Implementation

## Scope

Phase 4B adds a reusable workflow foundation in shadow mode.

Implemented:

- Additive workflow migration script.
- Budget cycle table design.
- Generic workflow instance model.
- Workflow transition history.
- Budget workflow state machine.
- Backend transition validation.
- Optimistic version checks.
- Idempotency by `idempotencyKey`.
- Audit integration inside the transition transaction when audit persistence is enabled.
- Budget Planner read-only workflow status.
- Workflow history read-only modal.
- Dry-run backfill command.

Not implemented:

- Authentication.
- RBAC enforcement.
- LE Matrix.
- Next FY generation.
- Transfer posting.
- Email/SMS notifications.
- Planner edit/delete lock enforcement.
- Automatic production/TiDB migration execution.

## Module Structure

```text
src/modules/workflow/
  workflow.constants.js
  workflow.transitions.js
  workflow.repository.js
  workflow.service.js
  workflow.controller.js
  workflow.routes.js
  workflow.validation.js
  workflow.errors.js
```

## Shadow Mode Behavior

Existing Budget Planner records remain editable and deletable through the current workflow.

`GET /api/budget-data` now adds read-only workflow metadata when available:

- `workflow_id`
- `workflow_status`
- `workflow_version`
- `workflow_is_locked`

Records without workflow rows display `Not Started`.

Workflow locks are not enforced on Budget Planner in Phase 4B.

## Temporary Actor

Authentication is not implemented. Workflow and audit records use a clearly marked system actor:

```text
actor_type: SYSTEM
actor_id: null
displayName: system
```

This must be replaced by authenticated request context in the RBAC phase.

## Audit Boundary

`workflow_history` is business lifecycle history.

`audit_logs` is technical/compliance audit history.

Successful workflow transitions write both inside the same transaction when `ENABLE_AUDIT_LOGS=true`. If audit insert fails while enabled, the workflow transaction rolls back.

## Formula Boundary

Existing formulas changed: No.

Workflow state changes govern lifecycle only. They do not calculate or mutate financial amounts.
