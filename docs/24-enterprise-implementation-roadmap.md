# Enterprise Implementation Roadmap

## Phase 4B Recommendation

Phase 4B should not start until Phase 4A completion declarations are accepted. Once accepted, the recommended next step is workflow foundation, not authentication.

## Phase 4B: Workflow Foundation

Deliverables:

- Add workflow tables as migrations only.
- Add workflow state-machine service.
- Add read-only workflow status projection beside existing records.
- Add audit event calls for workflow actions using current `legacy-user`.
- Add tests for valid/invalid state transitions.

No lock enforcement yet.

## Phase 4C: Budget Review And Lock

Deliverables:

- Budget submit/review/approve/lock APIs.
- UI status badges and action panel on Budget Planner.
- Version snapshots on approval/lock.
- Backend lock enforcement after UAT signoff.
- Notification events for submit/approve/lock.

## Phase 4D: LE Matrix

Deliverables:

- LE matrix schema.
- Server-side paged grid API.
- Server-paged row editor for the first safe release.
- Bulk save draft.
- Cell dirty tracking.
- LE submit action.
- Backend variance calculation.
- Material variance remarks enforcement.
- LE workflow validate/approve actions.

## Phase 4E: Variance Engine

Deliverables:

- Expand variance exception dashboards.
- Add advanced approvals and notifications.
- Add pivot/virtualized location-column matrix after row editor UAT.

## Phase 4F: Next FY Budget

Deliverables:

- Generate Next FY from approved LE.
- Manual and bulk adjustments.
- Versioning.
- Review/approve/lock workflow.

## Phase 4G: Transfer Module

Deliverables:

- Draft transfer creation.
- Same location/unit validation.
- Submit/approve/post/reverse.
- Transaction-safe posting.
- Transfer history and dashboard.

## Phase 4H: Fixed Cost Change Tracking

Deliverables:

- Reason-required fixed-cost updates.
- Old/new/difference capture.
- Visual highlight and dashboard panel.
- Audit and notification events.

## Phase 5: Authentication And RBAC

Only after workflow action boundaries are stable:

- Implement identity provider.
- Enforce permissions server-side.
- Add location-level access.
- Add approval queue scoped by permission and location.

## Migration Strategy

1. Create additive migrations.
2. Deploy migrations to development/TiDB demo only after approval.
3. Add service code behind feature flags.
4. Keep existing APIs working.
5. Add UI read-only status indicators.
6. Run UAT with shadow workflow state.
7. Activate workflow write actions.
8. Activate lock enforcement.

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Workflow locks break existing edits | High | Start with read-only workflow projection, then gated enforcement. |
| LE matrix performance degrades | High | Server-side paging, sparse cells, virtual scrolling. |
| Formula drift | High | Formula register tests before/after each phase. |
| Owner/Owner1 confusion | Medium | Keep data dictionary and UI labels explicit. |
| Transfer posting inconsistency | High | Use database transactions and immutable ledger. |
| Approval without RBAC | Medium | Use design-time permission boundaries only until auth exists. |
| Audit table not applied | Medium | Feature-gated audit persistence. |
## Phase 4E

Next FY Budget generation and approval engine. Manual UAT and authorized migration execution remain separate rollout activities.
