# Transfer Workflow

Workflow type:

```text
TRANSFER
```

States:

```text
DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> POSTED -> REVERSED
```

Cancellation path:

```text
DRAFT -> CANCELLED
SUBMITTED/UNDER_REVIEW -> CANCELLED via REJECT
```

Allowed actions:

- `SUBMIT`
- `START_REVIEW`
- `APPROVE`
- `POST`
- `REVERSE`
- `RETURN_TO_DRAFT`
- `REJECT`
- `CANCEL`

State changes are backend validated by `src/modules/workflow/workflow.transitions.js`.

## Audit Boundary

Workflow history and transfer history are separate:

- `workflow_history`: generic lifecycle state history.
- `budget_transfer_history`: transfer-specific business history.
- `audit_logs`: optional compliance audit when audit persistence is enabled.

Authentication is not implemented. Actor is the documented temporary system actor until RBAC.
