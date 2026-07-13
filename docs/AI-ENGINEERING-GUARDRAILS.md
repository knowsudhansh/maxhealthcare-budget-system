# AI Engineering Guardrails

## Formula Protection

Do not change any formula unless:

1. Business approval is recorded.
2. `docs/04-formula-register.md` is updated.
3. Regression tests are updated.
4. UAT validation is completed.
5. `docs/CHANGELOG.md` is updated.

## Implementation Discipline

- Inspect active source before changing code.
- Prefer small changes.
- Preserve active behavior.
- Do not remove legacy files without documenting why.
- Do not rename API fields without compatibility mapping.
- Do not change DB columns without migration.
- Do not format values before calculations.
- Do not save formatted financial strings to numeric DB columns.
- Do not expose secrets.
- Do not mix UAT and Production.
- Do not silently ignore failed DB writes.
- Do not continue after transaction failure.
- Do not implement incomplete auth/RBAC.
- Do not implement chatbot without RBAC-enforced boundaries.

## Financial Formatting Boundary

```text
Database numeric value
→ API numeric value
→ application calculation
→ formatted display value
```

- Use `formatFinancialAmount` only at display, PDF, report, and export-format boundaries.
- Use `parseFinancialAmount` before calculations or API submission if an amount may contain commas or a currency symbol.
- Keep database values, API payloads, localStorage records, chart datasets, and internal totals numeric.
- Use `en-IN` as the approved display locale.
- Existing formulas must remain unchanged when formatting is adjusted.

## Coding Normalization Boundary

```text
User search text
-> trimmed case-insensitive search key
-> canonical master-data record
-> original/canonical display value
-> unchanged API value semantics
```

- Coding comparison and search are case-insensitive.
- Coding suggestions must be deduplicated by normalized coding key.
- The application must never show duplicate Coding suggestions that differ only by letter case.
- Normalized keys are for comparison, filtering, and deduplication only; do not overwrite database data with normalized values.

## Budget Planner Field Clear Boundary

- Clear buttons must update visible input and application state.
- Clearing Coding or Item may clear only the fields currently mapped from coding/item selection.
- Individually selectable Planning Input fields clear only themselves unless an explicit dependency exists.
- Clear actions must not submit forms or change API payload meanings.

## Global Clearable-Field Boundary

```text
Selected display value
-> selected application state
-> filtered option state
-> dependent mapped state
-> clear action
-> reset to valid default
-> rerender affected screen only
```

- Every active filter or selectable field that supports a valid empty/default state should provide a consistent clear action.
- Clearing a field must clear both visible and internal state.
- Clearing one independent filter must not reset unrelated filters.
- Required workflow selectors without a valid empty state must be excluded and documented.

## Explicit All Is Selected State

The explicit `All` option is a selected value, not an empty placeholder.

Clear-button visibility must distinguish:

- empty/unselected,
- placeholder,
- explicit `All`,
- specific selected value.

Do not include `All`, `ALL`, `all`, or `*` in generic empty/default detection.

## Documentation First

Before major changes:

- Update architecture docs if affected.
- Update data dictionary if fields are added/changed.
- Update API contract if request/response changes.
- Update formula register if formulas change.
- Update testing checklist.
- Update changelog.

## Phase 3.1 Runtime Configuration Guardrails

- `APP_ENV` must be explicit.
- Development may use direct local DB credentials.
- UAT and Production must require `DB_SSL=true`.
- Production must reject wildcard CORS, localhost DB hosts, and secret names that look like UAT/test/development/local.
- UAT must reject secret names that look like Production.
- AWS Secrets Manager values must be loaded server-side only and cached; never fetch secrets per request.
- Do not log DB credentials, DB host/name, secret ARN, SQL, stack traces, or AWS account details in public responses.
- Keep formulas and API field meanings unchanged while refactoring runtime infrastructure.

## Phase 3.2 Write Reliability Guardrails

- Use `withTransaction` for multi-step allocation writes.
- Validate numeric inputs before writes; do not use `Number(value) || 0` for request validation.
- Preserve explicit allocation edit amounts; do not redistribute edited matrix rows unless the client omitted explicit amounts.
- Return standard public error responses with request IDs.
- Do not activate optimistic locking until `record_version` migration is applied.
- Do not enable audit persistence until `audit_logs` migration is applied.
- Existing formulas changed: No.

## Phase 3.2A Containerization Guardrails

- Docker packaging must not copy `.env`, local app data, service-account JSON, logs, or `node_modules` into the image.
- The container must run as a non-root user.
- Container health checks should use `/health/ready`.
- Containerization must not change formulas, API field meanings, database schema, or persistence behavior.
- Do not push images or provision AWS resources in Phase 3.2A.
