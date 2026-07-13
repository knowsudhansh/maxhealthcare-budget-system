# TiDB Demo Seed Data

This document describes the temporary TiDB Cloud Starter demo seed only.

The seed is not a production master-data approval and does not change any business formula.

## Seed Boundary

- Script: `scripts/seed-tidb-demo.js`
- Manual command: `npm run seed:tidb-demo`
- Marker: `TIDB_DEMO_SEED_V2`
- Table: `budget_submissions`
- Purpose: temporary multi-device demo rows for Budget Planner, Dashboard, Location Summary, and Allocation selection.

Coding master values and Budget Planner transaction rows remain separate concepts. The seed inserts only 20 temporary planner rows from the approved list below; it does not import the full coding master list.

## Cleanup Strategy

Before writing V2 rows, the script deletes only rows with the old deterministic demo marker:

```text
Temporary TiDB demo seed
```

For V2 reruns, the script updates rows already carrying `TIDB_DEMO_SEED_V2`. Extra duplicate V2 rows for the same coding are removed only when they also carry the V2 marker.

The script never deletes records based only on `coding`, because manual records may legitimately use the same coding.

## Owner Boundary

`owner1` is the business owner group, such as `Application`, `IT Infra`, `Unit`, or `Clinical`.

`owner` is the person-level or operational owner supplied in the approved mapping.

The seed keeps these fields separate. `owner1` never overwrites `owner`.

## Approved Demo Rows

| Coding | Location | FY | Current | Last FY | LE | Owner1 | Owner |
|---|---|---:|---:|---:|---:|---|---|
| ITOPEX005 | Saket | 2025-26 | 599999.32 | 540000 | 410000 | Unit | jatin |
| ITOPEX007 | Max Smart | 2025-26 | 450000 | 420000 | 360000 | Application | jatin |
| ITOPEX008 | Gurgaon | 2025-26 | 380000 | 355000 | 300000 | Application | Akshant |
| ITOPEX009 | Lajpat Nagar | 2025-26 | 900000 | 820000 | 740000 | Application | Akshant |
| ITOPEX011 | Panchsheel | 2025-26 | 650000 | 640000 | 520000 | IT Infra | Anil |
| ITOPEX013 | Patparganj | 2025-26 | 0 | 350000 | 0 | Application | Anil |
| ITOPEX014 | Vaishali | 2025-26 | 725000 | 690000 | 610000 | Unit | Unit |
| ITOPEX015 | Noida | 2025-26 | 880000 | 760000 | 640000 | IT Infra | Unit |
| ITOPEX018 | Shalimar Bagh | 2026-27 | 420000 | 390000 | 310000 | Application | Amit |
| ITOPEX023 | Mohali | 2026-27 | 575000 | 0 | 120000 | Application | Amit |
| ITOPEX024 | Dehradun | 2026-27 | 525000 | 0 | 100000 | Application | Arjun |
| ITOPEX029 | Bathinda | 2026-27 | 1200000 | 980000 | 830000 | IT Infra | Anil |
| ITOPEX032 | HO | 2026-27 | 760000 | 700000 | 650000 | Application | Arjun |
| ITOPEX033 | BLK | 2026-27 | 680000 | 600000 | 550000 | Application | Tauqueer |
| ITOPEX034 | Nanawati | 2026-27 | 1550000 | 1450000 | 1300000 | IT Infra | Anil |
| ITOPEX035 | Nagpur | 2026-27 | 310000 | 300000 | 260000 | Unit | Unit |
| ITOPEX036 | Lucknow | 2026-27 | 950000 | 820000 | 780000 | Application | Tauqueer |
| ITOPEX037 | Dwarka | 2026-27 | 875000 | 840000 | 760000 | IT Infra | Anil |
| ITOPEX038 | Jaypee Noida | 2026-27 | 1020000 | 990000 | 910000 | Clinical | Tauqueer |
| ITOPEX042 | Saket | 2026-27 | 1800000 | 1650000 | 1500000 | IT Infra | Anil |

All amounts are stored as numeric values without commas. Indian financial-number formatting is applied only in the display layer.

## Driver Amounts

For each row, the seed splits `loc_fy_current` across the existing driver columns so demo totals remain internally consistent:

- `new_amc`: 25%
- `new_project`: 15%
- `annualized`: 10%
- `price_increase`: 8%
- `new_unit`: 12%
- `license_increase`: 15%
- `rest`: remaining balance after rounding

For dropped rows, current-year and driver amounts are zero.
