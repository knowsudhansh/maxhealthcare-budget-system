# Location Hierarchy And Assignment Model

Phase 5C uses the existing `locations` and `user_locations` tables created by migration 013.

## Location Table

```text
locations
- id
- code
- name
- status
- parent_location_id
- created_at
- updated_at
```

Location codes are normalized by trimming whitespace, converting spaces to hyphens, and uppercasing. Display names remain separate.

## Assignment Table

```text
user_locations
- user_id
- location_id
- access_type
- valid_from
- valid_until
- assigned_by
- created_at
```

The table primary key is `(user_id, location_id, access_type)`. There is no standalone assignment ID, so API assignment identifiers are a derived composite token:

```text
userId:locationId:accessType
```

## Hierarchy Rules

- A location cannot be its own parent.
- A parent change cannot create a cycle.
- Disabled locations are ignored by authorization resolution.
- Parent access includes descendants only when `access_type=HIERARCHY`.
- Orphaned business records remain legacy text until a future approved backfill.

## Master Data Status

`npm run location:analyze-existing` found 19 distinct legacy Budget Planner location strings and no blank values. The approved normalized `locations` master is not yet populated, so Phase 5C does not seed guessed real hospital locations.
