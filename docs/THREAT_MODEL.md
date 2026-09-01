# Civra safety decisions

## Files

- Only files no larger than 10 MB are accepted.
- Browser-provided MIME values are hints only. Civra checks magic bytes before
  a file can reach the sandbox, and the sandbox checks again.
- The Civra host holds upload bytes in request memory only. It does not create
  a local upload directory or log document contents.
- Every sandbox is ephemeral and destroyed even when extraction fails.
- Unsupported, malformed, scanned, or non-searchable files return unknown or a
  safe error; Civra does not guess.

## Automation spending

- Solari credentials stay in server environment variables.
- Cookie sessions are HttpOnly and SameSite=Strict.
- A short access code gate, login cooldown, per-session document allowance,
  one-at-a-time document sandbox limit, city result cache, and city failure
  cooldown reduce accidental or public spend.
- These controls are process-local. A scaled deployment must add a shared
  limiter and a daily spend stop.

## Permit accuracy

- Civra uses one fixed official URL.
- A source page that changes shape fails closed to unknown.
- Requirement matches preserve evidence and source timestamp.
- A document evidence match is never treated as a permit submission decision.

## Explicit non-goals

No payment, final submission, city-account sign-in, password collection, or
credential storage is implemented. Any proposal adding one of those needs a
new threat review, tests, and clear owner approval.
