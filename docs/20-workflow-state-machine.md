# Workflow State Machine

## State Machine Boundary

Workflow state controls business actions. It must not alter financial formulas, raw amount storage, allocation percentages, or existing API field meanings.

## Budget Lifecycle

```text
Draft -> Submitted -> Under Review -> Approved -> Locked
```

| From | To | Action | Rules |
|---|---|---|---|
| Draft | Submitted | `budget.submit` | Required fields valid; totals calculated; no blocking validation errors. |
| Submitted | Under Review | `budget.review.start` | Reviewer accepts queue item. |
| Under Review | Draft | `budget.review.return` | Remarks required. |
| Under Review | Approved | `budget.approve` | Review checks complete; approval remarks captured. |
| Approved | Locked | `budget.lock` | No pending exceptions; lock confirmation required. |
| Locked | Draft | Not allowed | Requires separate unlock/revision workflow in a future phase. |

## Latest Estimate Lifecycle

```text
Draft -> Submitted -> Validated -> Approved
```

| From | To | Action | Rules |
|---|---|---|---|
| Draft | Submitted | `le.submit` | Matrix totals valid; required remarks present for exceptions. |
| Submitted | Validated | `le.validate` | Variance engine has run; all required confirmations captured. |
| Validated | Draft | `le.return` | Validation rejection remarks required. |
| Validated | Approved | `le.approve` | Approver confirms variance exceptions and locks approved LE version. |

Phase 4D implementation actions:

| From | To | Action |
|---|---|---|
| `DRAFT` | `SUBMITTED` | `SUBMIT` |
| `SUBMITTED` | `VALIDATED` | `VALIDATE` |
| `SUBMITTED` | `DRAFT` | `RETURN_TO_DRAFT` |
| `SUBMITTED` | `DRAFT` | `REJECT` |
| `VALIDATED` | `APPROVED` | `APPROVE` |
| `VALIDATED` | `DRAFT` | `RETURN_TO_DRAFT` |

## Transfer Lifecycle

```text
Draft -> Submitted -> Approved -> Posted
```

| From | To | Action | Rules |
|---|---|---|---|
| Draft | Submitted | `transfer.submit` | Same location/unit validation passes; amount positive; remarks mandatory. |
| Submitted | Draft | `transfer.return` | Reviewer remarks required. |
| Submitted | Approved | `transfer.approve` | Source budget availability confirmed. |
| Approved | Posted | `transfer.post` | Transaction posts debit/credit ledger atomically. |
| Posted | Reversed | `transfer.reverse` | Reversal record required; original remains immutable. |

## Next FY Budget Lifecycle

```text
Generated -> Reviewed -> Approved -> Locked
```

| From | To | Action | Rules |
|---|---|---|---|
| Generated | Reviewed | `nextfy.review` | Generated values reviewed; adjustment remarks captured. |
| Reviewed | Generated | `nextfy.return` | Reviewer remarks required. |
| Reviewed | Approved | `nextfy.approve` | Exceptions accepted; approval remarks captured. |
| Approved | Locked | `nextfy.lock` | Final confirmation; no pending transfer or variance exceptions. |

## Transition Enforcement

Every transition must check:

- Current state matches expected source state.
- Entity version matches client version when optimistic locking is active.
- Actor has the future permission boundary for the action.
- Mandatory remarks/reason fields are present.
- No open blocking validation or variance exception exists.
- Entity is not locked unless action is a permitted reversal/unlock proposal.

## Invalid Transition Response

Future API should return:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_WORKFLOW_TRANSITION",
    "message": "This workflow action is not allowed from the current state.",
    "requestId": "..."
  }
}
```
## Next FY Workflow

`GENERATED -> UNDER_REVIEW -> APPROVED -> LOCKED`

Allowed actions:

- `GENERATED`: `START_REVIEW`
- `UNDER_REVIEW`: `APPROVE`, `RETURN_TO_GENERATED`, `REJECT`
- `APPROVED`: `LOCK`
- `LOCKED`: no ordinary transition

`RETURN_TO_GENERATED`, `REJECT`, and `LOCK` require remarks.
