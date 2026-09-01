# Recorded NYC source proof

The public demo includes a saved result from a recorded Solari browser run
against the official NYC Food Service Establishment Permit page.

- Source: https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit
- Recorded: 2026-09-01T00:26:13.852Z
- Result: URL, title, expected application markers, and all four requirement
  phrases passed the fail-closed trust gates.

The machine-readable proof is committed at public/live-proof.json. It contains
only public source evidence; it has no API keys, owner files, cookies, or
portal credentials.

The first browser run correctly returned unknown because the application
requirements were behind the How To Apply tab. Civra was updated to open that
known tab; it did not convert the unseen requirements into missing answers.
