# Enterprise Workflow Platform Design

## Purpose

This document defines the target enterprise workflow platform for the MAX Healthcare IT OPEX Budget Management System.

This is an architecture design only. It does not implement authentication, RBAC, AI, new formulas, database migrations, or production data changes.

## Current Architecture Review

Current runtime:

- Frontend: `index.html`, `styles.css`, `app-config.js`, `app-utils.js`, `app-data.js`, `app-ui.js`, `app.js`.
- Backend: `server.js` with supporting modules under `src/`.
- Database: TiDB Cloud/MySQL-compatible tables used by current routes.
- Active tables: `budget_submissions`, `allocation_records`, `allocation_location_map`, `allocation_matrix`.
- Deployment: Render and Docker, with root and `APP_BASE_PATH` support.
- Stabilization: delegated events, pointer render gate, request single-flight, action locks, and base-path URL helpers.

Current business model:

- Budget Planner is transaction-oriented CRUD.
- Allocation records and matrix rows are persisted independently.
- Dashboard, Location Summary, Unit Wise Budget, Utilization, Comparison, and Reports are computed views over planner and allocation data.
- Audit and optimistic-locking foundations exist as proposals/foundations, but approval workflow is not active.

## Current Workflow Problems

- No lifecycle state exists for a budget record or budget cycle.
- Submission, review, approval, lock, LE, variance validation, Next FY generation, transfer approval, and final lock are not separate business events.
- Direct edit/delete actions remain available without state-based guardrails.
- LE is currently a numeric field on budget planner records, not a governed matrix/versioned process.
- Transfer between codings does not exist as a transaction ledger.
- Fixed-cost changes are not captured as old/new/difference/reason events.
- Dashboard views do not distinguish draft, submitted, approved, locked, variance exception, or pending approval.
- Notifications are not modeled.
- Permission boundaries are not defined at the business-action level, which would make later RBAC harder to enforce safely.

## Enterprise Workflow Design

Target workflow:

```text
Budget Registration
-> Budget Review
-> Budget Approval
-> Budget Lock
-> Latest Estimate
-> Variance Validation
-> LE Approval
-> Next Financial Year Budget
-> Approval
-> Final Lock
```

Core design rules:

- Workflow state is stored separately from the current transaction rows.
- Existing planner and allocation APIs remain compatible during migration.
- Formulas remain unchanged; workflows govern who can change data and when, not how amounts are calculated.
- Every state transition is explicit, validated, auditable, and reversible only through an approved reversal action.
- Locks prevent modification through backend rules, not only UI hiding.
- Workflow actions emit notification events and audit events.

## Business Entities

| Entity | Purpose | Existing compatibility |
|---|---|---|
| Budget Cycle | One financial-year planning cycle. | References existing `financial_year` values. |
| Budget Record | Existing planner row under workflow control. | References `budget_submissions.id`. |
| Budget Version | Snapshot of approved/locked data. | New table; no overwrite of existing rows. |
| Workflow Instance | Tracks entity lifecycle. | New generic workflow table. |
| LE Matrix | Coding x Location latest estimate grid. | New LE tables; can read current budget from existing records. |
| Variance Log | Captures LE versus budget exceptions. | New table; formulas documented separately. |
| Next FY Budget | Generated budget for next financial year. | New versioned table; source fields are existing budget + LE + adjustments. |
| Transfer | Movement between codings within location/unit controls. | New ledger table; does not mutate source budget until posted. |
| Fixed Cost Change | Tracks fixed-cost changes with reason. | New table linked to `budget_submissions`. |
| Notification | In-app workflow notification event. | New table; no email/SMS implementation yet. |
| Audit Event | Immutable business action history. | Extends existing audit foundation. |

## Formula Boundary

Existing formulas changed: No.

Workflow features must use the existing formula register for current budget, LE, variance, utilization, comparison, allocation distribution, and reports. Any future formula change requires business approval and formula-register update.

## Source Of Truth Boundary

```text
TiDB/MySQL records
-> workflow state
-> versioned workflow outputs
-> reporting/dashboard projections
```

`localStorage`, Excel, and Google Sheets remain convenience/import/export channels only. They must not become workflow authority.

## Recommended Product Navigation

Future platform navigation should evolve from tabs into workflow workspaces:

- Dashboard
- Budget Planner
- Budget Review
- Approvals
- Budget Lock
- LE Matrix
- Variance Exceptions
- Next FY Budget
- Transfers
- Reports
- Audit
- Notifications

Existing tabs should remain available until each workflow workspace is implemented and validated.
