# Latest Estimate Platform

Phase 4D introduces a Latest Estimate (LE) module that compares LE values with the current Budget baseline without overwriting Budget Planner data.

## Workflow

```text
Approved or Locked Budget
-> Create LE Matrix
-> Enter LE Values
-> Save Draft
-> Calculate Variance
-> Resolve Warnings
-> Submit
-> Validate
-> Approve
```

## Scope

- Matrix creation.
- Sparse changed-cell storage.
- Backend variance calculation.
- Material variance remarks enforcement.
- Server-side paging/filtering.
- Bulk changed-cell save.
- LE workflow through the generic workflow engine.
- Compact LE summary dashboard.

Out of scope: authentication, RBAC enforcement, Next FY, Transfer, Email/SMS, AI, and automatic Excel import.

## Baseline Rule

LE never writes to `budget_submissions`. Budget amount, coding, location, financial year, and source budget identity are captured into changed LE cells when saved. Existing matrices are not automatically rebased if Budget changes later.
