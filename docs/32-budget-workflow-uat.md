# Budget Workflow UAT Matrix

Use this checklist before enabling lock enforcement in UAT.

| Area | Automated | Manual Browser | Notes |
|---|---|---|---|
| Start Workflow | Pass via `npm run test:workflow-actions` | Not completed | Creates Draft workflow only. |
| Submit | Pass via workflow tests | Not completed | Sends expected version and idempotency key. |
| Start Review | Pass via workflow tests | Not completed | Backend-derived action. |
| Approve | Pass via workflow tests | Not completed | No RBAC enforcement yet. |
| Return to Draft | Pass via workflow tests | Not completed | Remarks required. |
| Reject | Pass via workflow tests | Not completed | Remarks required. |
| Lock | Pass via workflow tests | Not completed | Remarks required. |
| Edit Restriction | Pass via `npm run test:workflow-actions` | Not completed | Disabled by default. |
| Delete Restriction | Pass via `npm run test:workflow-actions` | Not completed | Disabled by default. |
| Version Conflict | Pass via `npm run test:workflow` | Not completed | Refresh state before retry. |
| Duplicate Click | Covered by first-click tests | Not completed for manual UAT | Idempotency key prevents duplicate transition history. |
| Root Path | Covered by base-path tests | Not completed | Existing APP_BASE_PATH helper retained. |
| Base Path | Covered by base-path tests | Not completed | `/budget-app` mode retained. |
| Keyboard | Existing first-click suite partially covers | Not completed | Manual keyboard UAT required. |
| History Modal | Pass via workflow tests/static UI checks | Not completed | Read-only. |
| Approval Queue | Pass via `npm run test:workflow-actions` | Not completed | Server-side pagination. |

Manual browser results must not be marked Pass until tested by a human in Chrome or Edge.
