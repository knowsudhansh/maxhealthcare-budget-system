# Enterprise UI And Backend Architecture

## Frontend Architecture Direction

The current browser app is functional but concentrated in large files:

- `app-data.js`: state defaults, data dictionaries, fallback data, formula helpers.
- `app-ui.js`: all rendering, exports, charts, tables, combo markup.
- `app.js`: API calls, event handling, state changes, workflow-like CRUD actions.

Future modules should be introduced incrementally without breaking current tabs.

Recommended structure:

```text
frontend/
  shared/
    urls.js
    formatters.js
    events.js
    components/
      clearable-field.js
      data-grid.js
      modal.js
      toast.js
  planner/
  allocation/
  workflow/
  le/
  nextfy/
  transfer/
  dashboard/
  reports/
```

Migration rule: first extract read-only helpers, then extract feature views, then move state transitions. Do not rewrite the whole UI at once.

## LE Matrix Product Design

Matrix layout:

```text
Toolbar: Year | Category | Owner | Coding search | Location filter | Validate | Bulk update | Submit

Frozen header:
Coding | Item | Owner1 | Owner | Total Budget | Total LE | Variance | Status | [Location columns...]

Frozen first column:
Coding + Item summary
```

Interaction requirements:

- Virtualized rows and columns for 10,000+ codings and 100+ locations.
- Server-side pagination and filtering.
- Cell-level dirty state.
- Bulk paste/update support.
- Validation panel for exceptions.
- Required remarks for LE over budget thresholds.
- Save draft and submit actions separated.
- No formula changes; display variance from approved formula register.

## Dashboard Architecture

Dashboards should become role/workflow-oriented views:

- Executive: current budget, LE, Next FY, variance, top changes.
- Finance: pending approvals, locked cycles, exceptions.
- Location: location budget, LE, transfer impact, utilization.
- Budget: registration, submitted, review, approved, locked counts.
- LE: matrix progress, variance exceptions, approval progress.
- Next FY: generated, reviewed, approved, locked totals.
- Transfer: pending, approved, posted, reversed.
- Audit: recent actions, high-risk changes, fixed-cost changes.

## Backend Architecture Direction

Recommended structure:

```text
src/
  modules/
    planner/
    allocation/
    workflow/
    latest-estimates/
    next-fy/
    transfers/
    variance/
    notifications/
    dashboards/
    audit/
  shared/
    errors/
    validation/
    permissions/
    pagination/
    money/
```

## Service Boundaries

| Module | Owns | Must not own |
|---|---|---|
| Planner | Budget record CRUD and compatibility. | LE approval, transfer posting. |
| Workflow | State transition validation/history. | Financial formulas. |
| LE | LE matrix cells, validation orchestration. | Budget Planner raw formulas. |
| Variance | Exception calculation/status. | Direct approval decisions. |
| Next FY | Generation/versioned adjustment. | Prior FY source edits. |
| Transfer | Draft/approval/posting ledger. | Location master maintenance. |
| Audit | Immutable action capture. | Business decisions. |
| Notifications | In-app event records. | Email/SMS delivery. |

## Notification Events

Design-only events:

- `BUDGET_SUBMITTED`
- `BUDGET_APPROVED`
- `BUDGET_LOCKED`
- `LE_SUBMITTED`
- `LE_EXCEEDS_BUDGET`
- `LE_APPROVED`
- `TRANSFER_PENDING`
- `TRANSFER_APPROVED`
- `TRANSFER_POSTED`
- `NEXT_FY_GENERATED`
- `NEXT_FY_APPROVED`
- `NEXT_FY_LOCKED`
- `FIXED_COST_CHANGED`

Delivery channels are future work. This phase designs only in-app event storage and API boundaries.

## AI Integration Notes

Future AI must remain restricted to approved app data and documentation.

Allowed future tool concepts:

- `getBudgetWorkflowStatus`
- `getLeVarianceSummary`
- `getTransferHistory`
- `getApprovalQueue`
- `getFormulaDefinition`
- `getBudgetAppHelp`

Forbidden tool concepts:

- unrestricted SQL execution
- environment variable reading
- filesystem browsing
- internet browsing
- credential access
- cross-location data access without backend authorization

The server must enforce identity, role, location, year, and action boundaries. Prompt instructions alone are not security.
