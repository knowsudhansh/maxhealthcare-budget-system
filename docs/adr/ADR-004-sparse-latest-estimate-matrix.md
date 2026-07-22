# ADR-004: Sparse Latest Estimate Matrix

## Status

Accepted for Phase 4D.

## Context

The target LE matrix can grow to 10,000+ codings and 100+ locations. Rendering or persisting every logical intersection would create unnecessary browser, API, and database load.

## Decision

Persist only changed LE cells in `latest_estimate_cells`. Paged reads join Budget baseline rows from `budget_submissions` with saved LE cells.

## Consequences

- Budget Planner values remain unchanged.
- Baseline values are captured when cells are saved.
- Bulk save payloads contain changed cells only.
- Backend summary APIs aggregate saved sparse cells.
- A future pivot/virtualized matrix can be added without changing the persistence boundary.

## Non-Goals

- One-million-cell browser rendering.
- Automatic rebasing after Budget changes.
- Excel import.
