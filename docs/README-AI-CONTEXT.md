# AI Context

## Safe Working Rules

- Preserve existing financial formulas unless a formula change is explicitly requested and documented.
- Preserve Indian financial formatting.
- Preserve root and path-based hosting.
- Do not hardcode root API paths.
- Do not bypass `AppUrls.api(...)` or the runtime base-path helpers.
- Do not attach event listeners during repeated rendering without cleanup.
- Do not initialize `app.js` or `app-ui.js` twice.
- Do not add polling without a single lifecycle owner.
- Do not use localStorage as the financial source of truth.
- Do not change coding master data during stabilization.
- Do not mix `owner` and `owner1`.
- Do not expose database errors, credentials, certificates, tokens, or connection strings.
- Do not weaken tests to hide defects.

## Files Safe To Change With Care

- `app-utils.js`: shared frontend utilities.
- `app.js`: event handling, API calls, refresh lifecycle, CRUD orchestration.
- `app-ui.js`: rendering and display/export behavior.
- `tests/*.test.js`: lightweight regression coverage.
- `docs/*.md`: implementation documentation.

## Files Requiring Special Caution

- `app-data.js`: contains formulas, static master/fallback options, and state normalization.
- `server.js`: API contract, database writes, health, static routing.
- `src/db/*`: database connectivity and transaction behavior.
- `migrations/*`: never edit already-applied migrations destructively.
- `.env`, `.env.docker`, `certs/*`: secrets and certificates must not be committed or printed.

## Phase 4A Summary

Phase 4A introduces:

- idempotent browser initialization guards,
- delegated single-click action handling,
- per-button async action locks,
- one refresh lifecycle,
- single-flight API refresh protection,
- root and `/budget-app` routing verification.

No formulas, database schemas, API field meanings, or remote data are changed by this phase.

## Phase 4A.1 First-Click Summary

The remaining multi-click defect was a browser event-order problem, not a missing listener problem.

Confirmed sequence:

```text
input focused
-> one pointer click on action button
-> input change/focusout requests full render
-> render can replace the clicked button before click delivery
-> first click is lost
```

`app.js` uses a pointer render gate to defer full renders while a connected action/navigation/combo target is inside an active pointer sequence. The deferred render is released after the click or pointer cancellation.

Future AI tools must not remove this protection unless an equivalent first-click browser test proves the replacement behavior.

Phase 4A.2 expanded browser coverage to Allocation Submit, Allocation Matrix edit/save/delete/export, Dashboard clear/export, Planner saved export, Report export, representative tab navigation, and root plus `/budget-app` hosting. Human manual keyboard and deployed Render verification are still separate acceptance items.

## Phase 4A.3 Status

Read-only Render route and browser initialization checks passed after the earlier root timeout, but Render is currently root-hosted; `/budget-app/*` returns `404`.

Local startup using the current `.env` was blocked by TiDB credential rejection. Do not change or print credentials without user direction.

Docker build still requires the actual corporate CA file passed through BuildKit secret `corp_ca`. The TiDB CA in `certs/` is not the corporate npm registry CA.

Phase 4B must not begin until manual Chrome/Edge acceptance, keyboard activation, Docker build/runtime, and final Phase 4A declarations are complete or explicitly waived by the project owner.

## Enterprise Workflow Design Context

The target platform design is documented in:

- `docs/19-enterprise-workflow-platform.md`
- `docs/20-workflow-state-machine.md`
- `docs/21-enterprise-database-design.md`
- `docs/22-enterprise-api-design.md`
- `docs/23-enterprise-ui-backend-architecture.md`
- `docs/24-enterprise-implementation-roadmap.md`
- `docs/adr/ADR-001-enterprise-workflow-before-rbac.md`

Workflow foundation must precede authentication/RBAC so future permissions map to real business actions.

Do not implement login, RBAC, AI, transfer posting, LE matrix persistence, or Next FY generation until the workflow foundation phase is explicitly started.

Existing formulas changed by workflow design: No.

## Phase 4B Workflow Foundation

Phase 4B adds shadow workflow support:

- `migrations/009_workflow_foundation.sql`
- `src/modules/workflow/*`
- `npm run test:workflow`
- `npm run workflow:backfill:dry-run`

Budget Planner workflow status is read-only. Existing planner save/edit/delete behavior remains available even if a workflow status says `LOCKED`; lock enforcement is a later approved phase.

Do not apply the workflow migration or backfill to TiDB/Production/UAT without explicit approval.

## Phase 4C Budget Workflow Actions

Phase 4C adds usable Budget workflow actions without authentication or RBAC:

- Start Workflow for legacy Budget Planner rows.
- Backend-derived action panel in Saved Records.
- Transition confirmation modal.
- Approval queue and workflow summary.
- Feature-flagged edit/delete enforcement with `WORKFLOW_LOCK_ENFORCEMENT_ENABLED=false` by default.

Future AI/tools must not treat `owner` or `owner1` as approver identity and must not enforce locks unless the enforcement flag is explicitly enabled.

## Phase 4D Latest Estimate

Phase 4D adds:

- `migrations/010_latest_estimate_foundation.sql`
- `src/modules/latest-estimates/*`
- Latest Estimate tab
- `npm run test:le`

LE stores sparse changed cells and does not overwrite Budget Planner data. Variance is backend-calculated only.
## Phase 4E

Next FY Budget is implemented as a standalone source-snapshot module under `src/modules/next-fy`. It generates from eligible approved LE, approved/locked Budget, hybrid fallback, or feature-flagged manual baseline. It must never update Budget or LE source records.

## Phase 4F Transfers

Budget Transfers are implemented as an additive ledger module under `src/modules/transfers`.

Important boundary:

```text
Original Approved Budget
+ Incoming Transfer Postings
- Outgoing Transfer Postings
= Working Budget
```

Transfers must not update `budget_submissions`, LE, or Next FY source amounts. Reversal creates reverse ledger entries and does not delete posted transfer history.
