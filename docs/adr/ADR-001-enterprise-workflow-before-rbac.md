# ADR-001: Build Workflow Foundation Before Authentication And RBAC

## Status

Proposed

## Context

The current system supports planning, allocation, dashboarding, reports, TiDB connectivity, Docker, base-path routing, and UI stabilization. It does not yet model enterprise budget lifecycle states, LE approval, transfers, or Next FY workflows.

Authentication and RBAC are required later, but RBAC cannot be designed safely unless the business action boundaries exist first.

## Decision

Create the enterprise workflow architecture before implementing login or RBAC.

Workflow design will define:

- Entities.
- Lifecycle states.
- Transition rules.
- Permission boundary names.
- Audit and notification events.
- Database tables.
- API contracts.
- UI module boundaries.

Authentication remains out of scope for this phase.

## Consequences

Positive:

- RBAC can later map to real business actions.
- Approval and lock behavior will not rely on UI hiding.
- AI boundaries can reference stable workflow services.
- Existing formulas and APIs remain protected during design.

Tradeoffs:

- Users still do not have login until a later phase.
- Workflow enforcement requires later migrations and backend implementation.
- Existing UI remains monolithic until extraction phases begin.
