# ADR-006: Transfer Ledger Architecture

## Status

Accepted for Phase 4F.

## Context

Enterprise finance transfer modules must preserve historical approved values while allowing controlled budget movement.

## Decision

Budget transfers are additive ledger transactions:

```text
Original Approved Budget
+ Incoming Transfers
- Outgoing Transfers
= Current Working Budget
```

The transfer engine does not overwrite approved Budget, LE, or Next FY values.

## Consequences

- Reports can show original and working budget separately.
- Reversal is an opposite posting, not deletion.
- Posting and reversal must be transactional.
- Future RBAC can bind permissions to transfer actions without changing financial storage.
