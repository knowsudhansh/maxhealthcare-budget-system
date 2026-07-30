# Kubernetes Environment And Secrets

Kubernetes configuration is split by sensitivity.

## ConfigMap

`budget-app-config` owns non-sensitive values:

- `APP_ENV=development`
- `NODE_ENV=production`
- `APP_BASE_PATH=/budget-app`
- `HOST=0.0.0.0`
- `PORT=3000`
- `DB_PORT=4000`
- `DB_SSL=true`
- `DB_SSL_CA=/run/secrets/tidb-ca.pem`
- cookie routing/proxy settings
- feature flags

## Secret

`budget-app-secrets` must be provisioned outside Git and must contain:

- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `AUTH_SESSION_SECRET`
- `tidb-ca.pem`

The CA is mounted as a file and referenced by `DB_SSL_CA`. The app reads that file once during startup and passes it to `mysql2` with `rejectUnauthorized: true`.

## Security Rules

- Do not commit real Secret manifests.
- Do not place DB credentials in ConfigMaps.
- Do not print decoded Secret values.
- Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Do not disable TLS verification.
- Keep `AUTH_SESSION_SECRET` stable across replicas.
- Keep cookie `Path` aligned to `APP_BASE_PATH`.

## Safe Secret Creation Pattern

`k8s/dev/secret.example.yaml` is comments only. Use it as a checklist, not an applyable manifest.

```powershell
kubectl create secret generic budget-app-secrets `
  -n dev `
  --from-literal=DB_HOST='<tidb-host>' `
  --from-literal=DB_NAME='<database-name>' `
  --from-literal=DB_USER='<database-user>' `
  --from-literal=DB_PASSWORD='<database-password>' `
  --from-literal=AUTH_SESSION_SECRET='<32-plus-character-session-secret>' `
  --from-file=tidb-ca.pem='<local-path-to-tidb-ca.pem>'
```

Do not paste real values into repository files or issue trackers.
