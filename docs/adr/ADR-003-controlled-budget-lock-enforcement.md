# ADR-003: Controlled Budget Lock Enforcement

## Status

Accepted for Phase 4C.

## Context

The Budget Planner already supports create, edit, delete, allocation, reports, TiDB, Render, Docker, and path-based hosting. Phase 4B introduced shadow workflow state without blocking legacy Planner operations.

Phase 4C needs usable Budget workflow actions while avoiding a risky hard lock before UAT and before authentication/RBAC exist.

## Decision

Budget workflow actions are enabled through backend transition APIs, but Planner edit/delete enforcement is controlled by `WORKFLOW_LOCK_ENFORCEMENT_ENABLED`.

Default rollout:

- `WORKFLOW_FOUNDATION_ENABLED=true`
- `WORKFLOW_ACTIONS_ENABLED=true`
- `WORKFLOW_APPROVAL_QUEUE_ENABLED=true`
- `WORKFLOW_LOCK_ENFORCEMENT_ENABLED=false`

The backend remains the source of truth for valid transitions and future lock enforcement. The frontend renders state, action metadata, and warnings.

## Consequences

- Existing users can continue Planner work during UAT.
- Workflow history and audit records can be validated before enforcing locks.
- Future RBAC can attach permission checks to existing action metadata.
- Lock enforcement can be enabled without changing formulas or API field meanings.

## Non-Goals

- Authentication
- RBAC enforcement
- LE Matrix
- Transfer posting
- Email/SMS delivery
- AI assistant
