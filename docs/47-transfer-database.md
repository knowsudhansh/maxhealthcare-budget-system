# Transfer Database Design

Migration:

```text
migrations/012_budget_transfer_foundation.sql
```

The migration is additive and non-destructive. It must not be applied to Production, UAT, or TiDB demo without explicit approval.

## Tables

- `budget_transfer_requests`: transfer header, workflow link, status, version, FY, total.
- `budget_transfer_lines`: source/destination budget line details and transfer amount.
- `budget_transfer_postings`: immutable debit/credit/reversal ledger entries.
- `budget_transfer_history`: transfer-specific business history.
- `working_budget_balances`: cached working balance summary derived from original budget plus postings.

## Ledger Rule

The transfer engine posts:

- source debit as a negative posting,
- destination credit as a positive posting,
- reversal entries as opposite-signed ledger postings.

It does not update `budget_submissions`, Latest Estimate tables, or Next FY tables.

## Working Balance

```text
working_budget = original_budget + incoming_transfers - outgoing_transfers
available_balance = working_budget
remaining_budget = working_budget
```

`working_budget_balances` is a convenience summary. The authoritative transfer movement is the immutable posting ledger.
