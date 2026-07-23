# Next FY Deployment Runbook

## Before UAT

1. Confirm `011_next_fy_budget_foundation.sql` is reviewed.
2. Apply migration only to the authorized UAT database.
3. Set feature flags:
   - `NEXT_FY_BUDGET_ENABLED=true`
   - `NEXT_FY_WORKFLOW_ENFORCEMENT_ENABLED=true`
   - `NEXT_FY_ALLOW_LEGACY_SOURCE=false`
   - `NEXT_FY_ALLOW_MANUAL_BASELINE=false`
   - `NEXT_FY_ALLOW_GENERATION_RESET=false`
4. Verify root and `APP_BASE_PATH=/budget-app` routes.
5. Run the full regression suite.

## Production

Production migration and enablement require separate approval. This implementation does not apply migrations or modify production data.

## Rollback

Disable `NEXT_FY_BUDGET_ENABLED` to hide the frontend surface. Database rollback is only for approved non-production recovery and is documented in the migration comments.
