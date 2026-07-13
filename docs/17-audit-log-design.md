# Audit Log Design

## Status

Phase 3.2 adds audit-log service and migration proposal only. Audit persistence is feature-gated and disabled unless explicitly enabled.

## Proposed Migration

See:

```text
migrations/006_create_audit_logs.sql
```

Suggested fields:

- `id`
- `entity_type`
- `entity_id`
- `action`
- `old_data`
- `new_data`
- `changed_by`
- `request_id`
- `created_at`

## Temporary User

Until login exists:

```text
changed_by = legacy-user
```

This is a documented placeholder, not a real person.

## Service Boundary

`src/audit/audit-service.js`:

- uses parameterized SQL,
- redacts sensitive fields,
- supports CREATE/UPDATE/DELETE-style events,
- can run inside the caller's transaction,
- does not expose secrets.

If the audit table is not applied, keep audit persistence disabled so writes continue to work.
