# Active File Map

## Active Files Loaded By `index.html`

| File | Active | Purpose |
|---|---:|---|
| `index.html` | Yes | Browser shell, tab containers, script loading. |
| `styles.css` | Yes | Active UI styles. |
| `app-utils.js` | Yes | Shared formatting and search-normalization utilities. |
| `app-data.js` | Yes | Static data, initial state, helper formulas, localStorage normalization. |
| `app-ui.js` | Yes | Rendering, filters, charts, exports, PDF, report rows. |
| `app.js` | Yes | API calls, event handlers, CRUD, allocation persistence, import, refresh. |

## Coding Normalization Boundary

```text
User search text
-> trimmed case-insensitive search key
-> canonical master-data record
-> original/canonical display value
-> unchanged API value semantics
```

Budget Planner Coding comparison and search are case-insensitive. Coding suggestions must be deduplicated by normalized coding key. The application must never show duplicate Coding suggestions that differ only by letter case.

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

Active searchable combo fields and native select filters use shared delegated clear handlers in `app-ui.js`. Field-specific state reset remains in `app.js` so API payload meanings and persistence behavior are unchanged.

## Active Backend Files

| File | Active | Purpose |
|---|---:|---|
| `server.js` | Yes | Express server, static serving, API endpoints, MySQL, Google Sheets, Excel append. |
| `package.json` | Yes | Root backend runtime dependency manifest. |
| `.env` | Yes locally | Runtime config and local MySQL credentials. Must not be committed with secrets. |

## Database And Setup Files

| File | Purpose |
|---|---|
| `sql/mysql-app-schema.sql` | MySQL schema draft with `budget_submissions`, `planner_records`, allocation tables. Current server mostly uses `budget_submissions`, not `planner_records`. |
| `sql/mysql-crud-examples.sql` | Example SQL against `planner_records`. |
| `sql/mysql-root-setup.sql` | Database/user setup helper. |
| `sql/sql.sql` | PostgreSQL-style legacy/alternate schema, not active in current Node server. |
| `DB_SETUP.md` | MySQL setup notes. Some statements are stale relative to active code. |

## Inactive Or Legacy JavaScript Files

These files are present but not loaded by `index.html`:

- `allocationEnhancements.js`
- `brandingEnhancements.js`
- `dashboard.js`
- `data.js`
- `excelReader.js`
- `layoutAlignment.js`
- `locationDataEnhancements.js`
- `reportEnhancements.js`
- `rollbackToday.js`
- `stabilityRecovery.js`
- `google-apps-script.gs`

They may contain older logic or experiments. Do not delete them until behavior is compared and archived.

## Other Files

| File/Folder | Notes |
|---|---|
| `style.css` | Not loaded; likely legacy stylesheet. |
| `server data/it-opex-budget-submissions.xlsx` | Local Excel mirror used by backend single-row save. |
| `backend/package.json` | Separate backend scaffold; no active `index.js` present in root active path. |
| `README.md` | Stale; claims local-only JSON/import behavior and 22 locations. Active code differs. |
