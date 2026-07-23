# Next FY API Contract

All routes are mounted below `/api` and respect `APP_BASE_PATH`.

## Endpoints

- `POST /api/next-fy/budgets`
- `GET /api/next-fy/budgets`
- `GET /api/next-fy/budgets/:budgetId`
- `POST /api/next-fy/budgets/:budgetId/assumptions`
- `GET /api/next-fy/budgets/:budgetId/preview`
- `POST /api/next-fy/budgets/:budgetId/generate`
- `GET /api/next-fy/budgets/:budgetId/lines`
- `POST /api/next-fy/budgets/:budgetId/lines/bulk-adjust`
- `GET /api/next-fy/budgets/:budgetId/summary`
- `GET /api/next-fy/budgets/:budgetId/comparison`
- `GET /api/next-fy/budgets/:budgetId/export-data`
- `POST /api/next-fy/budgets/:budgetId/workflow/transitions`

## Response Shape

Successful responses use:

```json
{
  "success": true,
  "data": {},
  "requestId": "..."
}
```

Errors use the centralized API error shape.
