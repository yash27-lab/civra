# Container deployment

Civra runs as a non-root Node container and writes public source snapshots to `/var/lib/civra-source-snapshots` inside the container.

## Build

```bash
docker build --tag civra:local .
```

## Run locally

```bash
docker run --rm --publish 4173:4173 \
  --env-file .env \
  --env NODE_ENV=production \
  --volume "$(pwd)/data/source-snapshots:/var/lib/civra-source-snapshots" \
  civra:local
```

Open `http://localhost:4173/api/health` to inspect non-secret capability readiness.

## Production requirements

- Inject `SOLARI_API_KEY` and `CIVRA_ACCESS_CODE` through the platform's secret manager.
- Mount durable storage at `/var/lib/civra-source-snapshots` or set `CIVRA_SOURCE_SNAPSHOT_DIR` to an equivalent writable persistent path.
- Keep the container behind TLS so production session cookies receive the `Secure` attribute.
- Do not mount owner-upload storage: uploads stay in request memory and the ephemeral sandbox only.

The container health check verifies that the server responds to `/api/health`; it does not spend a Solari API call.
