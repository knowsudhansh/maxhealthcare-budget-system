# System Overview

## Current Architecture

The application is a vanilla HTML/CSS/JavaScript budget dashboard with an Express/MySQL backend.

Runtime layers:

- Browser UI: `index.html`, `styles.css`, `app-data.js`, `app-ui.js`, `app.js`.
- Backend API/static server: `server.js`.
- Database: MySQL through `mysql2/promise`.
- Optional integrations: local Excel file, Google Sheets append, browser `localStorage`.
- Client-side libraries loaded from CDN: `xlsx`, `html2canvas`, `jspdf`, `@supabase/supabase-js` (Supabase is loaded but not used by active code).

## Active Frontend Flow

`index.html` loads:

1. `styles.css`
2. `xlsx.full.min.js`
3. `html2canvas`
4. `jspdf`
5. `app-data.js`
6. `app-ui.js`
7. `app.js`
8. Supabase CDN script

`app-data.js` creates `window.OpexData`, including static options, default state, record normalization, and helper formulas.

`app-ui.js` creates `window.OpexUI`, renders all screens, exports workbooks/PDFs, and contains most display formulas.

`app.js` controls API calls, create/update/delete workflows, allocation persistence, Excel upload, live refresh, event handling, and local fallbacks.

## Backend Flow

`server.js`:

- Serves static files from the repository root.
- Reads environment variables with `dotenv`.
- Creates one reusable MySQL pool.
- Exposes budget, allocation, matrix, import, and health endpoints.
- Writes single planner saves to MySQL, optional Google Sheets, and local Excel.
- Reads planner data from MySQL `budget_submissions`.

## Source of Truth Today

Current code does not yet enforce one clean source of truth.

Observed sources:

- MySQL `budget_submissions`: source for `GET /api/budget-data`.
- MySQL `allocation_records`: source for allocation controls.
- MySQL `allocation_matrix`: source for allocation matrix.
- Browser `localStorage`: fallback/cache for planner records and allocation overlays.
- Local Excel file `server data/it-opex-budget-submissions.xlsx`: append-only save mirror for single-record save.
- Google Sheets: optional append mirror for single-record save.

For UAT/Production, MySQL/RDS should become the authoritative source. Excel and Google Sheets should be import/export/reporting utilities only.

## Screens

Active tabs:

- Dashboard
- Budget Planner
- Location Summary
- Unit Wise Budget
- Allocation-Fixed and % wise
- Opex Budget Utilization
- Comparison
- Report

## Production Readiness Summary

Current code is useful for local/UAT-style validation but is not production-ready yet.

Major gaps:

- Real database credentials exist in `.env`.
- CORS is wildcard.
- No authentication or authorization.
- No centralized validation layer.
- No centralized error response format.
- No request IDs.
- No audit logging.
- No transaction wrapper for allocation create/edit.
- No environment separation.
- No AWS Secrets Manager integration.
- Schema and running API are not fully aligned.
- Business formulas are duplicated across frontend helper, UI, and export paths.

