# Phase 5C Location Access UAT

## Automated Status

| Area | Status | Evidence |
|---|---|---|
| Direct access | Pass | `npm run test:location-access` |
| Hierarchy access | Pass | `npm run test:location-access` |
| Global access | Pass | `npm run test:location-access` |
| Expired/future assignment handling | Pass | `npm run test:location-access` |
| Disabled location exclusion | Pass | `npm run test:location-access` |
| Location API root/prefix routes | Pass | `npm run test:location-access`, `npm run test:base-path` |
| Unprefixed bypass blocked | Pass | `npm run test:base-path` |
| RBAC permission seed | Pass | `npm run seed:rbac` |

## Development Registry

After Phase 5C seed:

```text
roles: 10
permissions: 55
rolePermissions: 176
```

## Existing Data Analysis

`npm run location:analyze-existing` found:

- distinct legacy Budget Planner locations: 19
- blank location values: 0
- case/whitespace duplicate normalized values: 0
- mapped to approved location master: 0

The approved location master is still required before Phase 5D enforcement.

## Manual UAT Pending

Manual authenticated tests remain blocked until Phase 5A bootstrap administrator creation is completed.

## Phase 5D Gate

Do not start full financial API protection until:

- approved location master data exists,
- legacy business location strings are mapped to location master codes,
- bootstrap admin exists,
- authenticated RBAC/location UAT is complete.
