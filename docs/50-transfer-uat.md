# Transfer UAT Checklist

## Setup

- Verify migration `012_budget_transfer_foundation.sql` has been reviewed.
- Verify `TRANSFER_MODULE_ENABLED=true`.
- Verify `TRANSFER_POSTING_ENABLED=true` only when posting is approved for the environment.
- Verify `TRANSFER_REVERSAL_ENABLED=true` only when reversal is approved for the environment.

## Functional Acceptance

| Scenario | Expected Result | Status |
|---|---|---|
| Create Coding to Coding transfer | Draft request created, no budget row overwritten | Not run |
| Submit transfer | Status becomes Submitted | Not run |
| Start review | Status becomes Under Review | Not run |
| Approve transfer | Status becomes Approved | Not run |
| Post transfer | Debit/credit ledger entries created | Not run |
| Reverse transfer | Opposite ledger entries created | Not run |
| Insufficient balance | Request is rejected safely | Not run |
| Duplicate click | One request or idempotent result | Not run |
| Working budget | Original + incoming - outgoing | Not run |

Manual UAT was not executed by this implementation phase.
