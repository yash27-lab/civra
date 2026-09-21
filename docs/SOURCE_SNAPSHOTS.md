# Source snapshots

Every successful live permit check records a public-source snapshot before Civra returns a result. A snapshot contains the official URL, final URL, page title, verified requirement evidence, trust-gate outcome, timestamp, and a normalized SHA-256 fingerprint. It never contains owner uploads, session cookies, access codes, or API keys.

## Change status

- `first_observation`: the first recorded version of this source.
- `unchanged`: the same normalized source content was observed again.
- `changed`: the latest official source differs from the prior snapshot and needs review.

If Civra cannot write the source snapshot, the live check fails closed and returns no result. This prevents an unrecorded city check from being treated as evidence.

## Reviewing history

An unlocked Civra session can retrieve recent snapshots from `GET /api/source-history`. Selecting a specific snapshot uses `GET /api/source-history/:snapshotId` to return its recorded requirement statuses, review notes, and official-page excerpts. Both endpoints are read-only, require the private Civra session, never return owner uploads or secrets, and do not launch a browser or spend a Solari API call. The owner dashboard shows the recorded title, observation time, truncated snapshot ID, trust-gate outcome, and an evidence view for the selected snapshot.

## Deployment

By default, local snapshots are written under `data/source-snapshots/`, which is ignored by Git. Set `CIVRA_SOURCE_SNAPSHOT_DIR` to a mounted persistent directory in production so snapshot history survives process restarts and deployments.

## Comparing changes

When a newly recorded fingerprint differs from the last one, Civra retains that prior fingerprint as the comparison baseline. An unlocked owner can use `GET /api/source-history/:snapshotId/compare` to see only requirement-level changes: added, removed, or changed statuses, notes, and official-page excerpts. It never launches a browser, sends an alert, or treats a difference as a decision; the owner still reviews the official source.

The on-disk store is single-instance safe. A multi-instance deployment needs shared durable storage and coordination before it can provide globally ordered snapshot history.
