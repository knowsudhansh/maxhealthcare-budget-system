# Restricted Budget App Chatbot Boundaries

The chatbot is not implemented in current code. Do not implement it until authentication and RBAC boundaries exist.

## Allowed Topics

The chatbot may answer only about:

- Budget records.
- Budget formulas.
- Allocation.
- Utilization.
- Location summaries.
- Comparison.
- Reports.
- Approved Budget App documentation.
- Application usage.

## Disallowed Topics

The chatbot must not answer:

- General world questions.
- News.
- Entertainment.
- Personal advice.
- Unrelated technology questions.
- Data outside the user's assigned location.
- Data outside the user's role.
- Credentials or security configuration.
- Information belonging to another user or location.

## Allowed Tool Shape

Use allowlisted server-side tools only:

- `getBudgetSummary`
- `getBudgetWorkflowStatus`
- `getUtilization`
- `getAllocationSummary`
- `getLeVarianceSummary`
- `getTransferHistory`
- `getApprovalQueue`
- `compareAuthorizedLocations`
- `getFormulaDefinition`
- `getBudgetAppHelp`

## Forbidden Tool Shape

Never provide:

- `executeAnySql`
- `readAnyTable`
- `readEnvironmentVariables`
- `browseInternet`
- `readServerFilesystem`

## Enforcement Rule

The server, not the language model, must enforce user identity, role, locations, years, and allowed actions.

Prompt instructions are not security.

## Future Workflow Context

When the enterprise workflow platform is implemented, chatbot answers must remain bounded by workflow services. It may explain workflow status, approval queues, variance summaries, transfer history, formulas, and usage help only through allowlisted backend tools.

The chatbot must not approve, lock, post, reverse, or modify financial records unless a later explicitly approved design adds backend-enforced action tools with authentication, RBAC, audit, and confirmation.
