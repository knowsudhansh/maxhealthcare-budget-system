# Allocation Transaction Design

## Current Tables

- `allocation_records`: allocation control row keyed by coding, owner, and financial year in active code.
- `allocation_location_map`: location percentage map.
- `allocation_matrix`: JSON location amount and percent maps by financial year, coding, owner, and cost distribution.

## Proven Bug Root Cause

Allocation matrix edit payloads can contain Indian-formatted strings such as `1,00,000`.

Before Phase 3.2, `server.js:cleanAmountMap` used:

```javascript
Number(value[location] || 0)
```

`Number("1,00,000")` returns `NaN`, and the code then stored `0`. This can turn edited location values into zero when formatted strings reach the API.

Phase 3.2 fixes this at the validation boundary by normalizing formatted amount strings before database writes.

## Transaction Boundary

Allocation control upsert:

```text
validate payload
begin transaction
upsert allocation_records
if targetAmount > 0:
  read allocation_location_map
  recalculate location amounts with existing F020 formula
  upsert allocation_matrix
optional audit write when enabled
commit
```

Allocation matrix upsert:

```text
validate payload
begin transaction
read allocation_location_map
preserve explicit location amounts when supplied
otherwise calculate amounts with existing F020 formula
validate allocated total
upsert allocation_matrix
update matching allocation_records target amount when present
optional audit write when enabled
commit
```

On failure, the transaction rolls back and the API returns a standard error response.

## Formula Protection

Existing allocation formulas changed: No.

F020 remains:

```text
totalBudget * locationPercent / weightTotal
```

No location percentages were changed.

## Future Recommendation

Normalize allocation matrix details into child rows by location after a controlled migration. Phase 3.2 preserves the current JSON-map schema.
