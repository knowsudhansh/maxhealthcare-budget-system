# Path-Based Routing

## Boundary

The public deployment prefix is configuration, not business logic.

Frontend and backend URLs must be generated from `APP_BASE_PATH`. No feature module may hardcode `/budget-app`.

## Root Mode

When `APP_BASE_PATH` is empty or `/`, these routes must work:

- `/`
- `/app-config.js`
- `/styles.css`
- `/api/budget-data`
- `/api/allocation-data`
- `/api/allocation-matrix`
- `/health/live`
- `/health/ready`

## Prefix Mode

When `APP_BASE_PATH=/budget-app`, these routes must work:

- `/budget-app` redirects to `/budget-app/`
- `/budget-app/`
- `/budget-app/app-config.js`
- `/budget-app/styles.css`
- `/budget-app/api/budget-data`
- `/budget-app/api/allocation-data`
- `/budget-app/api/allocation-matrix`
- `/budget-app/health/live`
- `/budget-app/health/ready`

Unprefixed health routes remain available for Docker and load-balancer target checks:

- `/health/live`
- `/health/ready`

## Frontend URL Rules

`index.html` loads local assets by relative paths:

- `./app-config.js`
- `./app-utils.js`
- `./app-data.js`
- `./app-ui.js`
- `./app.js`
- `./styles.css`

`app-config.js` must load before `app-utils.js`.

Frontend API calls must use `AppUrls.api(...)` through the centralized helper in `app-utils.js`.

Do not use hardcoded `fetch("/api/...")`.

## Backend URL Rules

The Express app strips the configured base prefix only for exact prefix matches.

`/budget-application` must not match `/budget-app`.

`/app-config.js` exposes only:

```javascript
window.APP_CONFIG = { basePath: "/budget-app" };
```

It must not expose database host, username, password, AWS secret ARN, tokens, or service-account details.

## Static Serving

Static serving is restricted to the active frontend asset allowlist.

Do not serve `.env`, certificates, keys, `node_modules`, migrations, tests, service-account JSON, logs, or `Server data`.

## Phase 4A.2 Browser Verification

`npm run test:first-click` exercises the same critical UI click paths in both root mode and `/budget-app` mode. This protects against regressions where the public prefix changes event targets, assets, or API URLs.
