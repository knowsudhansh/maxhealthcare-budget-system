# Workflow Transition Contract

## Budget States

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
LOCKED
```

## Supported Actions

```text
CREATE
SUBMIT
START_REVIEW
APPROVE
LOCK
RETURN_TO_DRAFT
REJECT
```

## Transition Matrix

| Current State | Action | Next State | Remarks Required |
|---|---|---|---|
| `DRAFT` | `SUBMIT` | `SUBMITTED` | No |
| `SUBMITTED` | `START_REVIEW` | `UNDER_REVIEW` | No |
| `SUBMITTED` | `RETURN_TO_DRAFT` | `DRAFT` | Yes |
| `SUBMITTED` | `REJECT` | `DRAFT` | Yes |
| `UNDER_REVIEW` | `APPROVE` | `APPROVED` | No |
| `UNDER_REVIEW` | `RETURN_TO_DRAFT` | `DRAFT` | Yes |
| `APPROVED` | `LOCK` | `LOCKED` | Yes |
| `LOCKED` | Any normal action | Rejected | N/A |

## Transition Request

```json
{
  "action": "SUBMIT",
  "expectedVersion": 1,
  "remarks": "Submitted for review",
  "idempotencyKey": "client-generated-action-id"
}
```

## Transition Response

```json
{
  "success": true,
  "data": {
    "workflowId": 123,
    "previousState": "DRAFT",
    "currentState": "SUBMITTED",
    "version": 2,
    "idempotent": false
  },
  "requestId": "..."
}
```

## Concurrency

Every transition checks `expectedVersion` when supplied.

If the stored `version_number` does not match, the API returns `409 WORKFLOW_VERSION_CONFLICT`.

## Idempotency

Clients should send `idempotencyKey` for transition requests.

If the same workflow receives the same idempotency key for the same action, the existing successful result is returned and no duplicate history row is inserted.

## Error Codes

- `WORKFLOW_NOT_FOUND`
- `INVALID_WORKFLOW_TRANSITION`
- `WORKFLOW_VERSION_CONFLICT`
- `WORKFLOW_ALREADY_LOCKED`
- `WORKFLOW_REMARKS_REQUIRED`
- `DUPLICATE_WORKFLOW_ACTION`
- `INVALID_WORKFLOW_ENTITY`
