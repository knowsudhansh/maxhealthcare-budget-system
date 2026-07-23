# Transfer API

All transfer APIs are additive under `/api/transfers` and use the existing success/error response conventions.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/transfers` | Create a Draft transfer request with one or more lines. |
| `GET` | `/api/transfers` | List transfer requests with safe filters and pagination. |
| `GET` | `/api/transfers/:id` | Read one transfer with lines, postings, and history. |
| `POST` | `/api/transfers/:id/submit` | Move Draft to Submitted. |
| `POST` | `/api/transfers/:id/review` | Move Submitted to Under Review. |
| `POST` | `/api/transfers/:id/approve` | Move Under Review to Approved. |
| `POST` | `/api/transfers/:id/post` | Post approved transfer ledger entries. |
| `POST` | `/api/transfers/:id/reverse` | Reverse a posted transfer with opposite ledger entries. |
| `GET` | `/api/transfers/:id/history` | Read transfer business history. |
| `GET` | `/api/transfers/dashboard` | Transfer KPI summary. |
| `GET` | `/api/transfers/working-budget` | Working budget balance rows. |

## Transition Payload

```json
{
  "expectedVersion": 1,
  "remarks": "Reviewed and approved.",
  "idempotencyKey": "client-generated-key"
}
```

The backend validates version and idempotency. Posting and reversal require remarks.

Existing API meanings changed: No.
