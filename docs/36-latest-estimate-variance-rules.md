# Latest Estimate Variance Rules

## Formula

```text
varianceAmount = latestEstimateAmount - budgetAmount
```

```text
variancePercentage = varianceAmount / absolute(budgetAmount) * 100
```

If Budget is zero and LE is zero, percentage is `0`.

If Budget is zero and LE is non-zero, percentage is `null` and severity is `ZERO_BASE_INCREASE`. The API must never return `NaN` or `Infinity`.

## Severity

Default thresholds:

- `LE_VARIANCE_WARNING_PERCENT=10`
- `LE_VARIANCE_MATERIAL_PERCENT=20`
- `LE_VARIANCE_WARNING_AMOUNT=100000`
- `LE_VARIANCE_MATERIAL_AMOUNT=500000`

Severity uses the more severe applicable percentage or amount threshold:

- `ON_BUDGET`
- `WITHIN_THRESHOLD`
- `WARNING`
- `MATERIAL`
- `ZERO_BASE_INCREASE`

## Remarks

Remarks are required for `MATERIAL` and `ZERO_BASE_INCREASE` variance.

Frontend validation is advisory. Backend enforcement is mandatory.
