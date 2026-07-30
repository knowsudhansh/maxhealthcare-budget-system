# Kubernetes Dev Deployment

Phase Kubernetes repair targets the `dev` namespace and preserves application-level base-path routing.

## Manifests

Repository manifests live in `k8s/dev/`:

- `configmap.yaml` - non-sensitive runtime configuration.
- `deployment.yaml` - app container, environment injection, probes, and TiDB CA mount.
- `service.yaml` - stable ClusterIP service on port `80` targeting container port `3000`.
- `ingress.yaml` - AWS ALB ingress preserving `/budget-app`.
- `secret.example.yaml` - commented key-name reference only; do not apply it.

## Startup Order

The application still starts in this order:

1. Load and validate environment.
2. Load optional DB secret.
3. Initialize the singleton MySQL pool.
4. Run startup `SELECT 1`.
5. Start Express on `0.0.0.0:3000`.

The previous crash occurred before step 5 because `APP_ENV`, `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` were missing from the pod environment.

## Apply Sequence

Do not apply a placeholder Secret. Create `budget-app-secrets` from approved secure inputs outside Git, then apply:

```powershell
kubectl apply -f k8s/dev/configmap.yaml
kubectl apply -f k8s/dev/service.yaml
kubectl apply -f k8s/dev/ingress.yaml
kubectl apply -f k8s/dev/deployment.yaml
kubectl rollout status deployment/budget-app -n dev --timeout=180s
```

Use `kubectl diff -f k8s/dev` before applying when a cluster context is available.

## Validation

Expected internal pod checks:

- `GET /health/live` returns process liveness.
- `GET /budget-app/health/ready` returns readiness only when TiDB is connected.
- `GET /budget-app/api/health` returns the sanitized compatibility health payload.

Expected external checks:

- `GET /budget-app`
- `GET /budget-app/`
- `GET /budget-app/app-config.js`
- `GET /budget-app/api/health`
- `GET /budget-app/api/auth/me` returns `401` before login.

Unprefixed `/api/*` must not be available when `APP_BASE_PATH=/budget-app`.

## Rollback

Use the deployment history:

```powershell
kubectl rollout history deployment/budget-app -n dev
kubectl rollout undo deployment/budget-app -n dev
```

Rollback does not modify database data.
