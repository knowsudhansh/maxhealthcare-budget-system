# UI Behavior Contract

## Phase 4A Stabilization Boundary

Phase 4A stabilizes existing UI behavior only.

It does not change financial formulas, API field meanings, database schema, coding master data, authentication, RBAC, workflow, chatbot, or dashboard features.

## Initialization Ownership

`app-ui.js` and `app.js` are browser-loaded scripts.

- `app-ui.js` owns rendering helpers, combo/select UI behavior, exports, and display-only helpers.
- `app.js` owns application state transitions, API calls, create/edit/delete actions, allocation persistence, import, and refresh lifecycle.

Both files have browser-level initialization guards:

- `window.__OPEX_UI_INITIALIZED__`
- `window.__OPEX_APP_INITIALIZED__`

Future changes must not initialize the whole app twice.

## Event Architecture

The app uses delegated document-level handlers because tab content is rerendered through `innerHTML`.

Event handlers must not be attached to buttons inside render functions unless those handlers are cleaned up before rerender.

Rules:

- Use one delegated handler for repeated controls.
- Keep non-submit buttons as `type="button"`.
- Use `preventDefault()` for delegated button actions.
- Do not mix inline `onclick` with delegated `data-action` handling.
- Do not add duplicate listeners during each render.

## Action Lock Behavior

Async write/export actions use `withButtonActionLock(button, asyncAction)`.

The lock:

- blocks duplicate concurrent execution for the same button,
- sets temporary disabled and `aria-busy` state,
- restores disabled and busy state in `finally`,
- does not globally lock unrelated buttons,
- lets errors propagate to the action-specific handler.

Current locked actions include Budget Planner save/delete, exports, allocation row delete, allocation modal save, and allocation submit.

## Refresh Lifecycle

`app.js` owns one refresh lifecycle:

```text
startRefreshLifecycle()
-> refreshAllData()
-> budget data + allocation controls + allocation matrix
-> one interval
-> pause while document.hidden
-> refresh once when visible again
```

Each dataset loader is protected by single-flight behavior, so the same endpoint is not fetched concurrently by overlapping timer ticks or manual refresh paths.

Current endpoints refreshed:

- `/api/budget-data`
- `/api/allocation-data`
- `/api/allocation-matrix`

## Source Of Truth

The database/API remains the shared source of truth.

`localStorage` can hold temporary UI convenience state and optimistic overlays only. It must not become the financial source of truth.

## Formula Boundary

UI stabilization must not change formulas. Raw numeric data must flow through existing formula logic before Indian financial formatting is applied for display.

## Owner Boundary

`owner1` is the business owner group.

`owner` is the person-level or operational owner.

Do not overwrite one with the other during UI stabilization.

## Phase 4A.1 First-Click Contract

The confirmed browser-level failure mode was:

```text
focused input
-> user clicks an action button
-> input change/focusout fires during pointerdown/mousedown -> click
-> change handler requests a full render
-> render replaces the container that contains the clicked button
-> the original click can be lost before the delegated action handler sees it
```

The previous initialization/action-lock work prevented duplicate handlers and duplicate concurrent requests, but it did not protect the pointer sequence from blur/change-driven rerenders.

`app.js` now owns a pointer render gate:

```text
pointerdown on action/navigation/combo control
-> hold the connected action target
-> defer full render requests while the pointer sequence is active
-> delegated click handler executes the intended action
-> release gate after click/pointercancel/window blur/hidden page
-> pointerup schedules a next-frame fallback release if no click arrives
-> run one deferred render if needed
```

Rules:

- Never rerender a container during a pointer sequence if it contains the active action target.
- Never let dropdown-close or blur/change handlers consume unrelated button actions.
- Never fix lost clicks by dispatching a synthetic second click.
- Never use arbitrary timeout delays to hide interaction defects.
- Test action buttons while an input has focus.
- Test action buttons while a dropdown or combo list is open.
- Critical write actions must have one-click browser coverage where practical.

## Phase 4A.2 Acceptance Evidence

`npm run test:first-click` now covers these real-browser one-click paths in root and `/budget-app` modes:

| Module | Action | One Click | One Request | Root | Base Path | Render |
|--------|--------|-----------|-------------|------|-----------|--------|
| Planner | Save | Pass | Pass | Pass | Pass | Not tested |
| Planner | Edit | Pass | N/A | Pass | Pass | Not tested |
| Planner | Delete | Pass | Pass | Pass | Pass | Not tested |
| Planner | Saved Excel export | Pass | N/A | Pass | Pass | Not tested |
| Allocation | Submit | Pass | Pass for allocation-data write | Pass | Pass | Not tested |
| Allocation Matrix | Edit modal open | Pass | N/A | Pass | Pass | Not tested |
| Allocation Matrix | Modal save | Pass | Pass | Pass | Pass | Not tested |
| Allocation Matrix | Delete | Pass | Pass for matrix and allocation delete endpoints | Pass | Pass | Not tested |
| Allocation Matrix | Excel export | Pass | N/A | Pass | Pass | Not tested |
| Dashboard | Export | Pass | N/A | Pass | Pass | Not tested |
| Dashboard | Location/Coding/Year/Owner clear | Pass | No duplicate API refresh | Pass | Pass | Not tested |
| Reports | Full report export | Pass | N/A | Pass | Pass | Not tested |
| Navigation | Major tabs | Pass | N/A | Pass | Pass | Not tested |

Keyboard focusability is covered for representative action/navigation buttons. Full Enter/Space activation still requires manual browser verification.

## Phase 4A.3 Completion Rule

Phase 4B must not begin unless Phase 4A completion declarations are all `Yes`, except items explicitly accepted as external infrastructure limitations by the project owner.

Current Phase 4A.3 evidence:

- Automated root and `/budget-app` browser tests pass.
- Render static UI, assets, health endpoints, and data APIs respond successfully after the prior root timeout.
- Render browser load initializes `window.OpexData` and `window.OpexUI` with no captured runtime exceptions or failed network events.
- Local app startup with the current `.env` is blocked by TiDB credential rejection; credentials were not printed or changed.
- Docker build remains blocked until the actual corporate CA is provided as a BuildKit `corp_ca` secret.
- Manual Chrome/Edge click-through and full keyboard activation remain required before Phase 4A can be closed.

## Phase 4B Workflow Status UI

Budget Planner Saved Records may display read-only workflow status metadata:

- Workflow Status
- Workflow Version
- Lock indicator
- History button

Phase 4B is shadow mode. Workflow status must not block Planner Save, Edit, Delete, import, export, or allocation behavior.

History opens through the existing delegated `data-action` architecture and must preserve first-click behavior.

## Phase 4C Budget Workflow Actions

Budget Planner Saved Records now renders:

- Workflow status and version.
- Lock indicator.
- Last transition action and timestamp.
- Backend-provided available actions.
- History button.

Legacy rows show `Start Workflow`. Transition actions open a confirmation modal and require remarks for `LOCK`, `RETURN_TO_DRAFT`, and `REJECT`.

Planner edit/delete buttons remain enabled unless `WORKFLOW_LOCK_ENFORCEMENT_ENABLED=true`. The backend is the source of truth when enforcement is enabled.

## Phase 4D Latest Estimate UI

The Latest Estimate tab is a server-paged row editor, not a full million-cell DOM grid.

- LE amount and remarks edits are tracked as dirty local cell state.
- Save sends changed cells only.
- Active LE inputs must not be rerendered while typing.
- Variance displayed after save comes from the backend.
- Approved LE matrices are read-only.
- Existing first-click and pointer render gate behavior must be preserved.
