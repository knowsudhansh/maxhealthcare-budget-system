# Testing Checklist

## Formula Regression

- Capture baseline totals for each tab.
- Run formulas with the same raw input before and after refactor.
- Verify no numeric total changes.
- Verify allocation distribution sum equals expected amount.
- Verify dashboard export and UI totals match.

## Formatting Tests

Required cases:

```javascript
formatFinancialAmount(0)
formatFinancialAmount(1000)
formatFinancialAmount(100000)
formatFinancialAmount(1250000.5)
formatFinancialAmount(-100000)
formatFinancialAmount(null)
formatFinancialAmount(undefined)
formatFinancialAmount("1,00,000")
parseFinancialAmount("1,00,000")
parseFinancialAmount("₹ 1,00,000.50")
```

## API Tests

- Create planner record.
- Read planner records.
- Update planner record.
- Delete planner record.
- Upload Budget_Planner Excel.
- Duplicate upload row.
- Validation failure.
- Database unavailable.
- Allocation create/read/update/delete.

## Allocation Tests

- Create allocation.
- Read allocation.
- Edit only owner.
- Edit only amount.
- Edit coding.
- Edit financial year.
- Zero amount.
- Decimal amount.
- Invalid percentage.
- Allocation percentage total not equal to 100.
- Database error during update.
- Concurrent edit.
- Refresh after edit.
- UAT database round trip.

## Manual UAT Checklist

- Dashboard filters and totals.
- Budget Planner add/edit/delete.
- Budget Planner Excel upload.
- Saved records filters.
- Location Summary totals.
- Unit Wise Budget totals.
- Allocation Control submit.
- Allocation Matrix edit/delete.
- Utilization calculations.
- Comparison metrics.
- Report screen.
- Excel exports.
- Dashboard PDF export.
- Data refresh after API save.
- Indian financial formatting.
- Formula comparison with baseline.
- Error messages.

## Phase 2 Formatting Test Command

Implemented lightweight Phase 2 command:

```bash
npm run test:formatting
```

Additional Phase 2 cases include `10,000`, `12,50,000`, `1,00,00,000`, empty string, `100000`, `-1,00,000`, and invalid strings.

## Financial Formatting Boundary

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

Manual UAT must confirm display formatting changed while raw totals, formulas, API payload types, and Excel numeric cell types remain unchanged.

## Budget Planner Coding And Clear Tests

Implemented lightweight command:

```bash
npm run test:planner-ui
```

Coverage includes:

- Coding normalization for lowercase, uppercase, mixed-case, and spaced input.
- Case-insensitive deduplication.
- Case-insensitive partial search.
- Canonical uppercase preference when case-only duplicates exist.
- Static clear-button wiring checks for accessible clear controls and full-list reset behavior.

Manual UAT must verify Budget Planner clear buttons for Coding, Item, Sub Category (Mapped), Category_IT, Sub Category, New Category, App Cate., Cate.3, Cate.4, Owner1, Owner, and Cost Center / Department.

## Global Clearable Field Tests

Implemented lightweight command:

```bash
npm run test:clearable-fields
```

Coverage includes:

- Shared combo and native select clear markup.
- Dashboard, Saved Planner Records, Location Summary, Unit Wise Budget, Allocation Matrix, Allocation Control, and Comparison field coverage.
- Allocation Coding and Item dependency-reset hooks.
- Allocation Cost Distribution required-field exclusion.
- Focus/visibility styling hooks.

Manual UAT must confirm that clearing one independent filter preserves all other filters and rerenders only the affected screen state.

## Explicit All Clear Visibility

The explicit `All` option is a selected value, not an empty placeholder.

Clear-button visibility must distinguish:

- empty/unselected,
- placeholder,
- explicit `All`,
- specific selected value.

Expected visibility:

- Empty: hidden.
- Placeholder: hidden.
- Explicit `All`: visible.
- Specific selected value: visible.
