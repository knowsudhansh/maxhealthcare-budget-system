# Formula Register

## FORMULA FREEZE

No formula may be added, removed, renamed, or modified without:

1. Business approval.
2. Formula-register update.
3. Automated test update.
4. UAT validation.
5. Changelog entry.

When refactoring duplicated formula code, prove through tests that the output is unchanged.

## Register

| ID | Formula | Screen/Use | Source Fields | Exact Calculation | Null / Zero Handling | Rounding | Locations |
|---|---|---|---|---|---|---|---|
| F001 | Driver total | Helpers/report | `newAmc,newProject,annualized,priceIncrease,newUnit,licenseIncrease,rest` | Sum all driver fields | Missing/invalid values become 0 via `num`/`toNumber` | No fixed rounding except display | `app-data.js:getBudget`, `app.js:recordFromForm`, `app.js:recalculateRecords` |
| F002 | Location % change | Planner/save/live | `locFyCurrent, locLe` | `(locFyCurrent - locLe) / locLe * 100` | If `locLe` is 0, result 0 | Planner live display uses `toFixed(2)` | `app.js:recalculateRecords`, `recordFromForm`, `updatePlannerLiveCalculations`, `app-ui.js:renderPlanner` |
| F003 | Share percent | Save/recalculate | `locFyCurrent,totalBudgetCurrentYear` or FY total | `locFyCurrent / total * 100` | If denominator is 0, result 0 | No fixed rounding except exports where rounded | `app.js:recalculateRecords`, `app-data.js:summaryRows`, `app-ui.js` |
| F004 | Cumulative percent | Save/recalculate/top80 | Running share by year or sorted contributor rows | Running sum of share percent | Empty rows produce 0 | Export may use `allocationRoundedValue` | `app.js:recalculateRecords`, `app-ui.js:computeDashboardTop80` |
| F005 | Current year budget | Dashboard | `locFyCurrent` | Sum matched records | Empty set 0 | Display formatted by `fmt` | `app-ui.js:renderDashboard`, `exportDashboardWorkbook` |
| F006 | Last-year budget | Dashboard/comparison/export | `locFyLast` | Sum matched records | Empty set 0 | Display formatted by `fmt` | `app-ui.js:renderDashboard`, comparison, exports |
| F007 | LE / total expense | Dashboard | `locLe` | Sum matched records | Empty set 0 | Display formatted by `fmt` | `app-ui.js:renderDashboard`, exports |
| F008 | Growth percent | Dashboard | `currentYearBudget,totalExpense` | `(currentYearBudget - totalExpense) / totalExpense * 100` | If `totalExpense` is 0, result 0 | Percent display `toFixed(2)` through `pct` | `app-ui.js:renderDashboard`, `exportDashboardWorkbook` |
| F009 | Remaining budget | Dashboard/utilization | `currentYearBudget,totalExpense` | `currentYearBudget - totalExpense` | Can be negative | Display formatted by `fmt` | `app-ui.js:renderDashboard`; utilization has separate row formula |
| F010 | Utilized amount | Dashboard | `currentYearBudget,remaining` | `currentYearBudget - remaining` (equals `totalExpense`) | Empty set 0 | Display formatted | `app-ui.js:renderDashboard` |
| F011 | Utilization percent | Dashboard | `utilizedAmount,currentYearBudget` | `utilizedAmount / currentYearBudget * 100` | If `currentYearBudget` 0, result 0 | Percent display | `app-ui.js:renderDashboard`, `exportDashboardWorkbook` |
| F012 | Location remaining | Dashboard pulse | `budget, expenseByLocation` | `budget - expenseByLocation[location]` | Missing expense 0 | Display formatted | `app-ui.js:renderDashboard` |
| F013 | Unit increase | Unit Wise Budget | `budget, le` | `budget - le` | Empty values 0 | Display formatted | `app-ui.js:renderUnitBudget` |
| F014 | Unit increase percent | Unit Wise Budget | `increase, le` | `increase / le * 100` | If `le` 0, result 0 | Percent display | `app-ui.js:renderUnitBudget` |
| F015 | Unit share percent | Unit Wise Budget | `locationBudget,totalBudget` | `locationBudget / totalBudget * 100` | If total 0, result 0 | Percent display | `app-ui.js:renderUnitBudget` |
| F016 | Location summary change amount | Location Summary | `fyCurrent,le` | `fyCurrent - le` | Empty 0 | Display formatted | `app-ui.js:renderLocationSummary` |
| F017 | Location summary change percent | Location Summary | `changeAmount,le` | `changeAmount / le * 100` | If `le` 0, result 0 | Percent display | `app-ui.js:renderLocationSummary` |
| F018 | Driver percentage | Summary data helper | Driver field and driver total | `driver / total * 100` | If total 0, result 0 | None until display | `app-data.js:summaryRows` |
| F019 | Planner distribution preview factor | Planner | `costDistribution,location percent` | If `costDistribution === "Distribution"`, `locFyCurrent * locationPercent / 100`, else `locFyCurrent` | Unknown percent 0 | Display only | `app-ui.js:renderPlanner`, `preparePlannerSave` |
| F020 | Allocation distributed location amount | Allocation | `totalBudget,location percent,weightTotal` | `totalBudget * locationPercent / weightTotal` | If weight total 0, result 0 | No fixed rounding; some export uses `allocationRoundedValue` | `app.js:buildDistributedLocationAmounts`, `app-ui.js:buildDistributionAmounts`, `server.js:buildAmountMap` |
| F021 | Allocation batch coding share | Allocation submit | selected coding base totals | If selected base total > 0: `codingBase / selectedBaseTotal`; else equal share | Equal share fallback | None | `app.js:allocation-submit` |
| F022 | Allocation target amount | Allocation submit | `batchTotal,share` | `batchTotal * share` | If amount input 0, uses selected coding base total | None | `app.js:allocation-submit` |
| F023 | Allocation edited row total | Allocation matrix | location amount map | Sum location amounts | Missing locations 0 | Rounded comparisons with `allocationRoundedValue` | `app.js:allocation-modal-save`, `app-ui.js:renderAllocation` |
| F024 | Comparison current budget | Comparison | effective records for location | Sum `locFyCurrent` | Empty 0 | Display formatted | `app-ui.js:comparisonLocationMetrics` |
| F025 | Comparison used budget | Comparison | `currentBudget,lastYearExpense` | `Math.max(0, currentBudget - lastYearExpense)` | Floor at 0 | Display formatted | `app-ui.js:comparisonLocationMetrics` |
| F026 | Comparison remaining budget | Comparison | `currentBudget,usedBudget` | `currentBudget - usedBudget` | Can be 0 or positive under current formula | Display formatted | `app-ui.js:comparisonLocationMetrics` |
| F027 | Comparison budget growth | Comparison | `budgetVariance,lastYearBudget` | `budgetVariance / lastYearBudget * 100` | If last year budget 0, result 0 | Percent display | `app-ui.js:comparisonLocationMetrics` |
| F028 | Comparison expense growth | Comparison | `expenseVariance,lastYearExpense` | `expenseVariance / lastYearExpense * 100` | If last year expense 0, result 0 | Percent display | `app-ui.js:comparisonLocationMetrics` |
| F029 | Comparison utilization percent | Comparison | `lastYearExpense,currentBudget` | `(lastYearExpense - currentBudget) / lastYearExpense * 100` | If last year expense 0, result 0 | Percent display | `app-ui.js:comparisonLocationMetrics` |
| F030 | Utilization tab used | Utilization | `locFyCurrent,locLe` | `Math.max(0, locFyCurrent - locLe)` | Floor at 0 | Display formatted | `app-ui.js:renderUtilization` |
| F031 | Utilization tab remaining | Utilization | `locFyCurrent,used` | `locFyCurrent - used` | Empty 0 | Display formatted | `app-ui.js:renderUtilization` |
| F032 | Utilization tab utilization | Utilization | `locLe,locFyCurrent` | `(locLe - locFyCurrent) / locLe * 100` | If `locLe` 0, result 0 | Percent display | `app-ui.js:renderUtilization` |
| F033 | Top 80 share | Dashboard top 80 | coding/item current and total budget | `row.current / budgetTotal * 100`; cumulative running sum | If budget total 0, share 0 | Export rounds via `allocationRoundedValue` | `app-ui.js:dashboardTopEightyInsights`, `computeDashboardTop80` |
| F034 | Increase alert percent | Dashboard top 80 | `current,last` | `(current - last) / last * 100`; if last 0 and current > 0 then `Infinity`/`New` | New row represented specially | Display as badge | `app-ui.js:dashboardTopEightyInsights`, `computeDashboardTop80` |

## Duplication Notes

The same formulas are implemented in multiple places:

- Financial parsing/formatting: `app-data.js:toNumber`, `app-ui.js:num`, `app.js:num`, `server.js:Number(...)`.
- Allocation distribution: `app.js`, `app-ui.js`, `server.js`.
- Dashboard metrics: render path and export path.
- Top 80 calculations: dashboard display and workbook export.
- Utilization formulas differ by screen; this must be validated with business before changing.

## Financial Formatting Boundary

Phase 2 introduced centralized formatting/parsing utilities for presentation boundaries only:

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

Existing formulas changed: No.

`formatFinancialAmount` must not be used inside business formulas. `parseFinancialAmount` may be used to normalize user-entered or formatted amount strings back to raw numbers before calculations or API submission.
