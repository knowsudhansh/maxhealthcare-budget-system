# Location Security API Contract

All routes are mounted below the configured API base path.

Root examples:

- `/api/locations`
- `/api/location-access/me`

Prefixed examples:

- `/budget/api/locations`
- `/apps/it-opex/api/location-access/me`

## Endpoints

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/locations` | `location.view` |
| `GET` | `/api/locations/tree` | `location.view` |
| `GET` | `/api/locations/:locationId` | `location.view` |
| `POST` | `/api/locations` | `location.create` |
| `PATCH` | `/api/locations/:locationId` | `location.update` |
| `GET` | `/api/location-access/me` | authenticated session |
| `GET` | `/api/location-access/users/:userId` | `location.view_assignments` |
| `PUT` | `/api/location-access/users/:userId` | `location.assign` |
| `POST` | `/api/location-access/users/:userId/assignments` | `location.assign` |
| `DELETE` | `/api/location-access/users/:userId/assignments/:assignmentId` | `location.assign` |

## Errors

- `401 AUTHENTICATION_REQUIRED`: no valid session.
- `403 LOCATION_ACCESS_DENIED`: authenticated but outside location scope.
- `400 LOCATION_VALIDATION_ERROR`: malformed location request.
- `404 LOCATION_NOT_FOUND`: requested location master record does not exist.

Errors must not expose the user's full allowed-location list.

## Assignment Rules

- `assigned_by` is taken from the authenticated server session.
- Browser `assignedBy` / `assigned_by` is rejected or ignored.
- `GLOBAL` access cannot be assigned through `user_locations`.
- Non-global administrators cannot assign locations outside their own effective scope.
- Assignment validity dates are honored.
