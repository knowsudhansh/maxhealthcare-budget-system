# Data Dictionary

## Planner Record Fields

| Frontend Field | Display/Excel Field | Backend/DB Field | Type | Notes |
|---|---|---|---|---|
| `id` | n/a | `id` | string/number | Local ids use `row_...`; MySQL ids are numeric in `budget_submissions`. |
| `savedAt` | Saved At | `submitted_at`/local only | string | Mixed naming. |
| `coding` | Coding | `coding` | string | ITOPEX code. |
| `item` | Item | `item` | string | Can be mapped from coding. |
| `subCategoryMapped` | Sub Category (Mapped) | `sub_category_mapped` | string | Active import/save support exists, schema may need migration. |
| `categoryIt` | Category_IT | `category_it` | string | Category filter source. |
| `subCategory` | Sub Category | `sub_category` | string | Planner/report field. |
| `newCategory` | New Category | `new_category` | string | Planner/report field. |
| `appCate` | App Cate. | `app_cate` | string | Planner/report field. |
| `cate3` | Cate.3 | `cate3` | string | Planner/report field. |
| `cate4` | Cate.4 | `cate4` | string | Planner/report field. |
| `owner1` | Owner1 | `owner1` | string | Department/group owner. |
| `owner` | Owner | `owner` | string | Owner filter and allocation key. |
| `costCenter` | Cost Center / Department | `cost_center_department` | string | Frontend sometimes refers to `costCenterDepartment`; mapping inconsistency exists. |
| `costDistribution` | Cost Distribution | `cost_distribution` | string | Default `Fixed Cost`; active allocation uses `Distributed`/`Distribution`. |
| `financialYear` | Financial Year | `financial_year` | string | Expected format `YYYY-YY`. |
| `location` | MAX Hospital / Location | `location` | string | Hard-coded list currently has 19 locations. |
| `locLe` | Location LE | `loc_le` | decimal | Used as expense/LE in many formulas. |
| `locFyCurrent` | Location FY Current | `loc_fy_current` | decimal | Current budget. |
| `locFyLast` | Location FY Last | `loc_fy_last` | decimal | Last-year budget. |
| `locPercent` | Location % Change | `loc_percent` | decimal | Calculated client-side; not stored in `budget_submissions` active path. |
| `newAmc` | New AMC | `new_amc` | decimal | Driver field. |
| `newProject` | New Project | `new_project` | decimal | Driver field. |
| `annualized` | Annualized | `annualized` | decimal | Driver field. |
| `priceIncrease` | Price Increase | `price_increase` | decimal | Driver field. |
| `newUnit` | New Unit | `new_unit` | decimal | Driver field. |
| `licenseIncrease` | License Increase | `license_increase` | decimal | Driver field. |
| `rest` | Rest | `rest` | decimal | Driver field. |
| `justification` | Justification | `justification` | text | Active import/save support exists, schema may need migration. |

## Allocation Control Fields

| Frontend Field | Backend Field | Notes |
|---|---|---|
| `coding` | `coding` | Part of allocation key. |
| `item` | `item` | Stored with allocation record. |
| `owner` | `owner` | Part of allocation key. |
| `financialYear` | `financial_year` | Included in current server upsert select, but schema unique key is currently only `(coding, owner)` in `mysql-app-schema.sql`; mismatch risk. |
| `mode` | `mode` | `Distributed`/`Distribution`. |
| `amountInput` | `amount_input` | Original entered amount. |
| `percentInput` | `percent_input` | Present but mostly unused. |
| `targetAmount` | `target_amount` | Amount allocated across locations. |

## Allocation Matrix Fields

| Frontend Field | Backend Field | Notes |
|---|---|---|
| `id` | `id` | Numeric DB id. |
| `financialYear` | `financial_year` | Matrix year. |
| `coding` | `coding` | Matrix coding. |
| `item` | `item` | Matrix item. |
| `owner` | `owner` | Matrix owner. |
| `costDistribution` | `cost_distribution` | Usually `Distributed`. |
| `totalBudget` | `total_budget` | Sum of location amounts after edit, or entered target amount on create. |
| `locationAmounts` | `location_amounts_json` | JSON amount map. |
| `locationPercents` | `location_percents_json` | JSON percent map. |

## Field Naming Risks

- `costCenter` vs `costCenterDepartment`.
- `Location`, `MAX Hospital`, `Max Hospital`.
- `Financial Year` vs `financialYear` vs `financial_year`.
- `Cost Distribution` vs `costDistribution` vs `cost_distribution` vs `mode`.
- Allocation record schema unique key does not include `financial_year`, but application treats year as part of key.

## Financial Formatting Boundary

Approved Phase 2 display flow:

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

Financial formatting is presentation-only. Database amounts, API amounts, local application state, localStorage records, allocation records, and Excel amount cells remain numeric.

The approved display locale is `en-IN`. If a formatted value such as `1,00,000` reaches an input or edit path, parse it with `parseFinancialAmount` before calculation or API submission.

## Coding Normalization Boundary

```text
User search text
-> trimmed case-insensitive search key
-> canonical master-data record
-> original/canonical display value
-> unchanged API value semantics
```

Coding comparison and search are case-insensitive. Coding suggestions are deduplicated by normalized coding key, with master/fallback coding values preferred before saved-record values. Case-only duplicate suggestions such as `itopex009` and `ITOPEX009` must render as one logical coding option.

## Budget Planner Field Clear Behavior

Planning Input combo fields expose a clear button when populated. Clearing Coding or Item clears the fields currently mapped by coding/item selection: `item`, `subCategoryMapped`, `categoryIt`, `subCategory`, `newCategory`, `appCate`, `cate3`, and `cate4`. Owner, Owner1, and Cost Center / Department are individually selectable and clear only their own state.

## Global Clearable-Field Boundary

```text
Selected display value
-> selected application state
-> filtered option state
-> dependent mapped state
-> clear action
-> reset to valid default
-> rerender affected screen only
```

Every active filter or selectable field that supports a valid empty/default state should provide a consistent clear action. Clearing a field must clear both visible and internal state. Clearing one independent filter must not reset unrelated filters.

Allocation Cost Distribution is excluded because the current allocation workflow forces `Distribution` mode and has no alternate valid empty behavior.
