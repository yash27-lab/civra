# Local testing

Run the complete offline validation suite from the repository root:

```bash
npm run check
```

The check performs JavaScript syntax checks and runs the full test suite. Tests inject the Solari boundary, so they do not spend a live API key.

Run one layer while iterating:

```bash
npm run test:server
npm run test:ui
```

Use synthetic fixtures only. Never place owner documents, access codes, or production credentials in the repository or test output.
