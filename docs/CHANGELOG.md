# Changelog

## Unreleased

### Documentation

- Added current-state system documentation for UAT/Production preparation.
- Added formula register with formula freeze rule.
- Added API, data dictionary, database, environment, deployment, security, RBAC, chatbot, testing, and backup documentation.

### Formula Impact

- Existing formulas changed: No.

### Implementation Notes

- This documentation pass does not implement Phase 2+ production changes.
- Any future formula refactor must be backed by regression tests and UAT validation.

### Phase 2 Financial Formatting

- Added centralized `formatFinancialAmount` and `parseFinancialAmount` utilities.
- Applied `en-IN` Indian financial display formatting through active UI helpers.
- Applied Excel number formats to financial cells while keeping workbook values numeric.
- Added lightweight formatter/parser and formula regression tests.
- Existing formulas changed: No.

### Budget Planner UI Correction

- Added case-insensitive Coding normalization and deduplication for Budget Planner suggestions.
- Added Planning Input clear buttons for searchable combo fields.
- Added dependency-aware clearing for Coding and Item mapped fields.
- Added lightweight planner UI normalization tests.
- Existing formulas changed: No.

### Global Clearable Fields

- Extended the clear-button pattern to active searchable dropdowns and native select filters across Dashboard, Saved Planner Records, Location Summary, Unit Wise Budget, Allocation, Allocation Matrix, and Comparison.
- Added shared native-select clear wrapper and delegated clear handling.
- Preserved required Allocation Cost Distribution behavior without a misleading clear button.
- Added lightweight global clearable-field tests.
- Existing formulas changed: No.

### Clear Button All-State Fix

- Fixed clear-button visibility so explicit `All` values show a clear button.
- Preserved empty/placeholder states as clear-button hidden.
- Updated clear behavior so clearing `All` returns fields to empty/placeholder state without resetting unrelated filters.
- Existing formulas changed: No.
