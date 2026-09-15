# Operations runbook

## Readiness

Check `GET /api/health` after deployment. The response exposes non-secret capability status:

- `ready` means live checks and document verification have the required server configuration.
- `configuration_required` means the static owner experience is available, but live checks are intentionally disabled.
- `sourceSnapshotStorage` reports whether snapshots use the local default or a configured persistent directory.

## Required production configuration

- `SOLARI_API_KEY`
- `CIVRA_ACCESS_CODE`
- `CIVRA_SOURCE_SNAPSHOT_DIR` mounted on persistent storage
- `NODE_ENV=production`

Never place these values in browser code, client-side configuration, issue reports, or test fixtures.

## Checks after deployment

1. Confirm `/api/health` reports the expected capabilities.
2. Open a new owner session and confirm remaining check budgets appear.
3. Run a synthetic source check only when an authorized Solari budget is available.
4. Confirm a snapshot is visible in the authenticated source-history panel.
