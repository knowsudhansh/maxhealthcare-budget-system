# Budget Approval Queue

Phase 4C adds an additive approval queue for Budget workflows.

## API

`GET /api/workflows/queue`

Supported query filters:

- `workflowType`
- `state`
- `financialYear`
- `location`
- `coding`
- `owner`
- `page`
- `pageSize`

The backend applies deterministic sorting by workflow update time and ID. Page size is capped at 100.

## UI

The Budget Planner displays a compact approval queue with:

- Coding
- Location
- Financial Year
- Amount
- Owner
- Current State
- Available Action

No bulk approval is implemented in Phase 4C.

## Source of Truth

Queue rows are loaded from backend workflow/budget joins. Large approval summaries must not be calculated entirely in the browser.
