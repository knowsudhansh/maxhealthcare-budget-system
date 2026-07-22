# ADR-002: Shadow Workflow Foundation

## Status

Accepted for Phase 4B implementation.

## Context

The current application stores financial planning and allocation data directly in existing tables. Introducing approval and lock behavior immediately would risk breaking active Budget Planner usage and demo workflows.

## Decision

Implement workflow state as separate shadow data:

- Link `workflow_instances` to existing rows by `entity_type` and `entity_id`.
- Keep existing Budget Planner save/edit/delete behavior unchanged.
- Show workflow status read-only.
- Do not enforce `LOCKED` against Planner writes in Phase 4B.
- Require all state changes to use the workflow transition service.

## Consequences

Positive:

- Existing app behavior remains compatible.
- Workflow APIs and transition rules can be tested safely.
- Legacy rows can be backfilled gradually.
- RBAC can later map to workflow actions.

Tradeoffs:

- A locked workflow status is informational until the enforcement phase.
- Legacy rows without workflow instances show `Not Started`.
- Backfill is a separate controlled command.
