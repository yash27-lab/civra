# Local testing

Run the complete offline validation suite from the repository root:

```bash
npm run check
```

The check performs JavaScript syntax checks and runs the full test suite. Tests inject the Solari boundary, so they do not spend a live API key.

Run one layer while iterating:

```bash
npm run test:server
npm run test:source
npm run test:ui
```

Use `npm run test:source` when changing snapshot history, freshness gates, or evidence comparison. Use synthetic fixtures only. Never place owner documents, access codes, or production credentials in the repository or test output.

## Maintenance cadence

Use these checks for small owner-facing changes. They are operational controls, not compliance certification.

- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm run check` before publishing a change.
- [ ] Run `npm run test:source` when source evidence or freshness behavior changes.
