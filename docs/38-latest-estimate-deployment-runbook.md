# Latest Estimate Deployment Runbook

## Preconditions

- Phase 4B workflow migration applied.
- Phase 4D migration reviewed.
- `LATEST_ESTIMATE_ENABLED=true`.
- Variance thresholds approved by Finance.
- No production migration without explicit authorization.

## Migration

Run `migrations/010_latest_estimate_foundation.sql` only in an approved environment.

Rollback requires explicit approval and must confirm no active LE data depends on the tables.

## Verification

```bash
npm run test:le
npm run test:le-variance
npm run test:le-api
npm run test:le-workflow
npm run test:le-ui
npm run test:le-migration
```

Then run the full regression suite.

## Deployment Notes

Pushing code to the AWS Git remote is source backup only. It is not AWS runtime deployment.
