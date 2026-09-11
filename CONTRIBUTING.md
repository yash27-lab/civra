# Contributing

Keep changes focused and preserve Civra's fail-closed behavior: unsupported, unavailable, or ambiguous evidence must remain unknown rather than being treated as a pass.

Before opening a pull request, run:

```bash
npm run check
```

Do not use real owner documents or live production credentials in tests. When changing evidence matching, access controls, or sandbox behavior, include a focused test that demonstrates the intended fail-closed outcome.
