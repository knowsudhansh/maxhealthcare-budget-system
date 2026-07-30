# Kubernetes Base Path Validation

The Kubernetes dev deployment uses Architecture A: preserve the public prefix.

```text
Browser request:      /budget-app/api/health
Ingress forwards:     /budget-app/api/health
Application receives: /budget-app/api/health
APP_BASE_PATH:        /budget-app
Derived API path:     /budget-app/api
```

No ingress rewrite annotation is used.

## Expected Routes

- `/budget-app` redirects to `/budget-app/`.
- `/budget-app/` serves the UI.
- `/budget-app/app-config.js` exposes safe runtime config only.
- `/budget-app/api/health` returns compatibility health.
- `/budget-app/health/ready` verifies database readiness.
- `/health/live` remains available inside the pod.

## Blocked Routes

When `APP_BASE_PATH=/budget-app`, these are not supported API bypasses:

- `/api/auth/login`
- `/api/rbac/roles`
- `/api/locations`
- `/api/location-access/me`

## ALB Settings

The dev ingress uses AWS Load Balancer Controller annotations:

- Scheme: internal
- Target type: IP
- Backend protocol: HTTP
- Listener: HTTPS 443
- Health check path: `/budget-app/health/ready`
- Success code: `200`

The application is responsible for handling the `/budget-app` prefix.
