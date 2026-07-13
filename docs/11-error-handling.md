# Error Handling

## Current State

Errors are handled per-route using `try/catch`. Response shapes vary.

Examples:

- `{ message: error.message }`
- `{ message: "Deleted successfully.", affectedRows }`
- Raw backend messages can reach frontend.

## Required API Error Shape

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe message for the user.",
    "requestId": "request-id"
  }
}
```

## Required Error Codes

- `VALIDATION_ERROR`
- `AUTHENTICATION_REQUIRED`
- `ACCESS_DENIED`
- `RECORD_NOT_FOUND`
- `RECORD_CONFLICT`
- `ALLOCATION_TOTAL_INVALID`
- `DUPLICATE_RECORD`
- `RATE_LIMIT_EXCEEDED`
- `DATABASE_UNAVAILABLE`
- `INTERNAL_ERROR`

## Required Health Endpoints

- `GET /health/live`
- `GET /health/ready`

Readiness should test DB connectivity but not expose credentials or infrastructure details.

## Phase 3.1 Health Behavior

Implemented:

- `GET /health/live` returns `200 { "status": "alive" }`.
- `GET /health/ready` returns `200 { "status": "ready", "database": "connected" }` when `SELECT 1` succeeds.
- `GET /health/ready` returns `503 { "status": "not-ready", "database": "unavailable" }` when the DB pool is unavailable.
- Legacy `GET /api/health` remains available with sanitized MySQL connectivity booleans.

These endpoints must not expose DB host, DB name, username, password, secret ARN, stack trace, SQL, or AWS account identifiers.

## Current Risk

The current code can expose internal DB messages. Production must not return stack traces, SQL text, local file paths, AWS secret names, or credentials.
