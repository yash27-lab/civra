# Civra architecture

## Scope

Civra supports one narrow task: determine whether a small-business owner has
reviewable evidence for the current NYC Food Service Establishment Permit
requirements. It never submits or pays.

## Source verification

1. The server uses one fixed NYC URL; clients cannot supply another target.
2. A recorded Solari browser opens the page and selects the required
   application tab.
3. Civra verifies the final URL, page title, known page markers, and a minimum
   number of requirement phrases.
4. Any failed trust gate makes every requirement unknown. Found results retain
   the official-page excerpt.
5. The resulting requirement set has a version and source timestamp.

## Document verification

1. The owner opens a short-lived, HttpOnly Civra session.
2. The browser sends raw document bytes only to the Civra server, never to a
   city site.
3. Civra rejects files over 10 MB and validates PDF, JPEG, or PNG signatures
   from their bytes, not the browser MIME value.
4. A fresh Solari sandbox receives the validated bytes at a random guest path.
5. The sandbox validates the signature again, extracts basic image dimensions
   or PDF metadata/text with its local Poppler reader when available. A
   conservative literal-text fallback, including bounded Flate streams, avoids
   a network package install.
6. Civra matches extracted text to the versioned requirements. It reports
   ready, missing, or unknown with a reason and evidence where available.
7. Civra destroys the sandbox in a finally block. The upload is not written to
   the Civra host filesystem or retained after the response.

## Metering

The city check caches a successful result for 15 minutes, coalesces concurrent
requests, and enters a cooldown after failure. Document checks do not cache
private uploads: each session may perform three checks and each server runs one
sandbox check at a time. A production multi-instance service also needs a
shared rate/spend limit.

## Trust boundary

City text and document text are data. Neither can introduce actions, URLs,
instructions, or submission authority. An owner must review all evidence before
any future external action.
