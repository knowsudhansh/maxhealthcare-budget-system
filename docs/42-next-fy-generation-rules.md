# Next FY Generation Rules

The backend is authoritative for all generated values.

```text
baseAmount = sourceAmount
growthAmount = baseAmount * growthPercentage / 100
generatedAmount = baseAmount + growthAmount + fixedAdjustmentAmount
finalBudgetAmount = generatedAmount + manualAdjustmentAmount
```

Numbers are raw numeric values. Indian-formatted display strings are never used for calculations.

## Source Snapshot

Every generated line stores source type, source entity, source line, source version, source FY, target FY, coding, location, item, category, owner, owner1, and source amount.

## Regeneration

Regeneration is blocked when manual adjustments exist. A future reset feature must be explicit, audited, and feature-flagged.
