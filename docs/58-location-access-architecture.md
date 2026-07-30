# Phase 5C Location Access Architecture

Phase 5C introduces the reusable location authorization foundation. It does not yet protect every existing financial endpoint; full business-module enforcement remains Phase 5D.

## Trusted Resolution

Location scope is resolved only from server-side data:

```text
validated session
-> users
-> permissions
-> user_locations
-> active locations
-> hierarchy descendants when access_type=HIERARCHY
```

The browser may request a location as a filter or target, but it never defines the authenticated user's location scope.

## Scope Modes

- `GLOBAL`: user has explicit `location.access_all`.
- `RESTRICTED`: user has active direct or hierarchy assignments.
- `NONE`: user has no active assignments and no global permission.

Empty assignments do not imply global access.

## Access Types

- `DIRECT`: assigned location only.
- `HIERARCHY`: assigned location plus active descendants.
- `GLOBAL`: permission-driven only through `location.access_all`; not accepted as a user-location assignment.

The legacy assignment value `VIEW_EDIT` is treated as `DIRECT` for compatibility with migration 013.

## Policies

Read-list helpers can safely intersect requested locations with allowed scope. Sensitive exports and writes must fail with `403` if any requested location is unauthorized.

Write helpers require every target location to be authorized. Future Phase 5D modules should use this for create, update, delete, submit, approve, transfer source/destination, and export workflows.

## Auth Context

`req.auth.locationScope` contains:

- `mode`
- `directLocationIds`
- `effectiveLocationIds`
- `effectiveLocationCodes`
- `assignments`

It never includes password hashes, session token hashes, cookies, database secrets, SQL, or unauthorized location details.

## Current Business Data

Existing business tables use descriptive location strings, not normalized location IDs:

- `budget_submissions.location`
- allocation matrix JSON location keys
- `allocation_location_map.location`
- transfer line source/destination location text
- Latest Estimate and Next FY generated line location text

No existing financial data was converted in Phase 5C.
