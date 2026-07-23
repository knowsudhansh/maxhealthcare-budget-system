# ADR-005: Next FY Source Snapshot and Assumption Engine

## Status

Accepted for Phase 4E.

## Decision

Next FY budgets are stored as independent headers and lines. Generated lines preserve source snapshots instead of referencing live Budget or LE values at render time.

## Rationale

Finance review requires reproducibility. If a Budget or LE source changes later, an existing Next FY budget must remain explainable and must not silently drift.

## Consequences

- Regeneration is explicit and blocked after manual adjustments.
- Source eligibility is enforced by backend logic.
- Assumption priority is deterministic.
- Future RBAC can enforce permissions at API action boundaries without changing financial calculations.
