# Phase 4F Transfer Engine

The Enterprise Budget Transfer module moves budget capacity through additive transactions. It never overwrites approved Budget, approved LE, or approved Next FY source values.

## Architecture

```text
Approved budget baseline
+ posted incoming transfer ledger
- posted outgoing transfer ledger
= current working budget
```

The active implementation lives in:

- `src/modules/transfers/transfer.validation.js`
- `src/modules/transfers/transfer.ledger.js`
- `src/modules/transfers/transfer.repository.js`
- `src/modules/transfers/transfer.service.js`
- `src/modules/transfers/transfer.controller.js`
- `src/modules/transfers/transfer.routes.js`

All writes use the singleton MySQL/TiDB pool and transaction helper.

## Supported Types

- `CODING_TO_CODING`
- `DEPARTMENT_TO_DEPARTMENT`
- `LOCATION_TO_LOCATION`
- `OWNER_TO_OWNER`
- `CATEGORY_TO_CATEGORY`
- `CROSS_LOCATION`
- `CROSS_DEPARTMENT`
- `CROSS_FINANCIAL_UNIT`
- `FULL_TRANSFER`
- `PARTIAL_TRANSFER`

## Validation Boundary

Transfer validation checks:

- source and destination budget line IDs are positive integers,
- source and destination are different,
- financial year follows the existing `YYYY-YY` convention,
- amount is finite and greater than zero,
- source budget line exists,
- destination budget line exists,
- source line has an approved/locked Budget workflow or is a legacy approved baseline,
- amount does not exceed available working balance.

Existing formulas changed: No.
