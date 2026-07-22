# Workflow Testing Guide

## Commands

```bash
npm run test:workflow
```

Existing regression commands still apply:

```bash
npm run test:first-click
npm run test:phase4a
npm run test:phase3-1
npm run test:phase3-2
npm run test:base-path
npm run test:tidb
npm run test:docker
npm run test:formatting
npm run test:planner-ui
npm run test:clearable-fields
```

## Current Coverage

`tests/workflow-foundation.test.js` covers:

- Valid state transition.
- Invalid transition rejection.
- Locked-state rejection.
- Remarks requirement.
- Workflow creation.
- Transaction commit.
- Rollback on history failure.
- Rollback on audit failure when audit is enabled.
- Optimistic version conflict.
- Idempotent retry.
- Legacy `Not Started` status attachment.
- Workflow API create, transition, history, invalid transition.
- Static migration safety checks.

## Browser/UAT Checks

Manual UAT should confirm:

- Budget Planner shows Workflow Status.
- Legacy rows show Not Started.
- History opens on first click.
- History modal does not block Save/Edit/Delete.
- Save/Edit/Delete continue to work for all planner rows.
- Root and `/budget-app` modes still load.
- No formula totals change.
