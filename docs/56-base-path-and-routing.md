# Phase 5B Base Path And Routing

The public deployment prefix is configuration, not business logic.

## Configuration

`APP_BASE_PATH` controls the app prefix:

- empty or `/` -> root deployment
- `/budget` -> one-level prefixed deployment
- `/apps/it-opex` -> nested prefixed deployment

`API_BASE_PATH` is not a separate runtime setting in Phase 5B. It is derived from `APP_BASE_PATH`:

```text
APP_BASE_PATH=/apps/it-opex
API base path=/apps/it-opex/api
```

## Runtime Frontend Config

`app-config.js` exposes only safe routing and feature data:

```javascript
window.APP_CONFIG = {
  basePath: "/apps/it-opex",
  appBasePath: "/apps/it-opex",
  apiBasePath: "/apps/it-opex/api"
};
```

It must never expose database settings, AWS secrets, session secrets, cookies, or tokens.

## API Examples

Root deployment:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/rbac/roles`

Prefixed deployment:

- `/budget/api/auth/login`
- `/budget/api/auth/logout`
- `/budget/api/auth/me`
- `/budget/api/rbac/roles`

Nested deployment:

- `/apps/it-opex/api/auth/login`
- `/apps/it-opex/api/rbac/roles`

When a non-root `APP_BASE_PATH` is configured, unprefixed `/api/*` is not an alternate API bypass. Health endpoints `/health/live` and `/health/ready` remain unprefixed for Docker and load balancers.

## Cookie Path

The session cookie path follows the application base path:

- root deployment -> `Path=/`
- `/budget` deployment -> `Path=/budget`
- `/apps/it-opex` deployment -> `Path=/apps/it-opex`

Logout clears the cookie using the same path as login.

## Frontend Rule

All frontend requests must use `AppUrls.api(...)` or `buildApiUrl(...)`. Feature code must not hardcode root-relative `/api/...` paths or deployment prefixes.

## Kubernetes Dev Rule

The Kubernetes dev ALB must preserve `/budget-app`; it must not rewrite the prefix to `/`. With `APP_BASE_PATH=/budget-app`, the application accepts `/budget-app/api/*`, `/budget-app/health/*`, and `/budget-app/app-config.js`.

Unprefixed `/health/live` remains available for container liveness. Unprefixed `/api/*` remains blocked in prefixed mode.
