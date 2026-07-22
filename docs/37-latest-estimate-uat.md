# Latest Estimate UAT

| Scenario | Automated | Manual Browser | Notes |
|---|---|---|---|
| Create LE matrix | Static/API wiring covered | Not completed | Requires migration applied in target DB. |
| Load baseline | Static/API wiring covered | Not completed | Server-paged baseline rows. |
| Edit LE value | Static UI covered | Not completed | No active-input rerender. |
| Enter remarks | Static UI covered | Not completed | Required for material variance. |
| Save changed cells | Unit/static covered | Not completed | Transactional backend design. |
| Bulk paste | Not implemented | Not completed | Future enhancement. |
| Filter | Static UI covered | Not completed | Server-side filters. |
| Pagination | Validation covered | Not completed | Page size capped. |
| Submit | Workflow transition covered | Not completed | Generic workflow engine. |
| Validate | Workflow transition covered | Not completed | Backend checks summary. |
| Approve | Workflow transition covered | Not completed | Approved matrix read-only. |
| Return to Draft | Workflow transition covered | Not completed | Remarks required. |
| Reject | Workflow transition covered | Not completed | Remarks required. |
| Conflict | Static/service coverage | Not completed | Matrix/cell versions checked. |
| Duplicate click | Existing first-click suite | Not completed for LE | Idempotency key used. |
| Keyboard navigation | Not completed | Not completed | Manual UAT required. |
| Root path | Regression covered | Not completed | Existing base-path helpers retained. |
| Base path | Regression covered | Not completed | Existing base-path tests retained. |
| Large dataset | Not load-tested | Not completed | Server-paged row editor only. |

Manual UAT must be performed before business rollout.
