# Operations runbook

## Readiness

Check `GET /api/health` after deployment. The response exposes non-secret capability status:

- `ready` means live checks and document verification have the required server configuration.
- `configuration_required` means the static owner experience is available, but live checks are intentionally disabled.
- `sourceSnapshotStorage` reports whether snapshots use the local default or a configured persistent directory.
- `documentSourceMaxAgeDays` reports the maximum age of a verified city snapshot allowed before document review is blocked.

A ready response should include a capability object like:

```json
{"livePermitChecks":true,"documentVerification":true,"sourceSnapshotStorage":"persistent","documentChecksRequireFreshVerifiedSource":true,"documentSourceMaxAgeDays":7}
```

## Required production configuration

- `SOLARI_API_KEY`
- `CIVRA_ACCESS_CODE`
- `CIVRA_SOURCE_SNAPSHOT_DIR` mounted on persistent storage
- `CIVRA_SOURCE_MAX_AGE_DAYS` set to the owner-approved source review window
- `NODE_ENV=production`

Never place these values in browser code, client-side configuration, issue reports, or test fixtures.

## Checks after deployment

1. Confirm `/api/health` reports the expected capabilities.
2. Open a new owner session and confirm remaining check budgets appear.
3. Run a synthetic source check only when an authorized Solari budget is available.
4. Confirm a snapshot is visible in the authenticated source-history panel.
5. Confirm document verification refuses a stale snapshot before a file is uploaded, then use a fresh verified source only for an authorized synthetic check.
