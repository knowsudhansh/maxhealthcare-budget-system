# Latest Estimate API Contract

All endpoints are additive and path-safe through `APP_BASE_PATH`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/latest-estimates/matrices` | Create LE matrix and LE workflow in Draft. |
| `GET` | `/api/latest-estimates/matrices` | List matrices with pagination. |
| `GET` | `/api/latest-estimates/matrices/:matrixId` | Read one matrix. |
| `GET` | `/api/latest-estimates/matrices/:matrixId/cells` | Read paged baseline plus saved LE cells. |
| `POST` | `/api/latest-estimates/matrices/:matrixId/cells/bulk-save` | Transactionally save changed cells only. |
| `GET` | `/api/latest-estimates/matrices/:matrixId/summary` | Read backend summary KPIs. |
| `GET` | `/api/latest-estimates/matrices/:matrixId/variance` | Read variance rows. |
| `GET` | `/api/latest-estimates/matrices/:matrixId/export-data` | Read export-ready rows. |
| `POST` | `/api/latest-estimates/matrices/:matrixId/workflow/transitions` | Apply LE workflow transition. |

The frontend must not send authoritative variance values. The backend recalculates variance for every bulk save.
