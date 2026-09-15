const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const { setTimeout: wait } = require("node:timers/promises")
const { createServer } = require("./server")
const { PERMIT_URL, evaluatePermitPage, sourceFingerprint } = require("./solari-service")
const { identifySignature, makeChecklist } = require("./document-verification-service")
const { createSourceSnapshotStore } = require("./source-snapshot-store")

const goodPage = {
  finalUrl: PERMIT_URL,
  title: "Food Service Establishment Permit - NYC Business",
  text: `
    Food Service Establishment Permit
    Review these steps before you submit your application.
    Requirements Checklist
    Bring a Certificate of Authority to Collect Sales Tax.
    A Food Protection Certificate is required for the manager.
    Show proof of workers' compensation and disability insurance.
    Give a valid email address for city notices.
  `
}

test("source fingerprints ignore whitespace but detect source changes", () => {
  const whitespaceOnly = { ...goodPage, text: goodPage.text.replace(/\s+/g, " ") }
  const changed = { ...goodPage, text: goodPage.text.replace("valid email address", "contact email") }

  assert.equal(sourceFingerprint(goodPage), sourceFingerprint(whitespaceOnly))
  assert.notEqual(sourceFingerprint(goodPage), sourceFingerprint(changed))
})

test("source snapshots retain the current fingerprint and change history", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "civra-snapshots-"))
  try {
    const store = createSourceSnapshotStore({ directory })
    const firstCheck = {
      source: PERMIT_URL,
      finalUrl: goodPage.finalUrl,
      title: goodPage.title,
      checkedAt: "2026-09-01T00:00:00.000Z",
      sourceFingerprint: sourceFingerprint(goodPage),
      pageVerified: true,
      reasons: [],
      checks: {}
    }
    const first = await store.record(firstCheck)
    assert.equal(first.change, "first_observation")

    const unchanged = await store.record({
      ...firstCheck,
      checkedAt: "2026-09-01T01:00:00.000Z"
    })
    assert.equal(unchanged.change, "unchanged")
    assert.equal(unchanged.snapshotId, first.snapshotId)

    const changedPage = { ...goodPage, text: goodPage.text.replace("valid email address", "contact email") }
    const changed = await store.record({
      ...firstCheck,
      checkedAt: "2026-09-02T00:00:00.000Z",
      sourceFingerprint: sourceFingerprint(changedPage)
    })
    assert.equal(changed.change, "changed")
    assert.equal(changed.previousSnapshotId, first.snapshotId)

    const index = JSON.parse(await fs.readFile(path.join(directory, "index.json"), "utf8"))
    assert.equal(index.latestSnapshotId, changed.snapshotId)

    const history = await store.list()
    assert.equal(history.length, 2)
    assert.equal(history[0].snapshotId, changed.snapshotId)

    const stored = JSON.parse(await fs.readFile(path.join(directory, `${first.snapshotId}.json`), "utf8"))
    assert.equal(Object.hasOwn(stored, "text"), false)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("a healthy city page returns found for every need, with evidence", () => {
  const result = evaluatePermitPage(goodPage)

  assert.equal(result.pageVerified, true)
  assert.deepEqual(result.reasons, [])
  for (const [key, check] of Object.entries(result.checks)) {
    assert.equal(check.status, "found", `${key} should be found`)
    assert.equal(typeof check.evidence, "string")
  }
  assert.match(result.checks.salesTax.evidence, /Certificate of Authority/i)
})

test("a single dropped requirement reads as missing, not unknown", () => {
  const text = goodPage.text.replace(/Show proof of workers.+\n/, "")
  const result = evaluatePermitPage({ ...goodPage, text })

  assert.equal(result.pageVerified, true)
  assert.equal(result.checks.insurance.status, "missing")
  assert.equal(result.checks.insurance.evidence, null)
  assert.equal(result.checks.salesTax.status, "found")
})

test("a redirect to another address fails closed to unknown", () => {
  const result = evaluatePermitPage({ ...goodPage, finalUrl: "https://nyc-business.nyc.gov/nycbusiness/somewhere-else" })

  assert.equal(result.pageVerified, false)
  assert.ok(result.reasons.some(reason => /different address/.test(reason)))
  for (const check of Object.values(result.checks)) {
    assert.equal(check.status, "unknown")
    assert.equal(check.evidence, null)
  }
})

test("query strings and trailing slashes on the same page are fine", () => {
  const result = evaluatePermitPage({ ...goodPage, finalUrl: `${PERMIT_URL}/?utm_source=civra#top` })
  assert.equal(result.pageVerified, true)
})

test("an unexpected page title fails closed to unknown", () => {
  const result = evaluatePermitPage({ ...goodPage, title: "Page not found" })

  assert.equal(result.pageVerified, false)
  assert.ok(Object.values(result.checks).every(check => check.status === "unknown"))
})

test("a rewritten page with most phrases gone fails closed to unknown", () => {
  const result = evaluatePermitPage({
    ...goodPage,
    text: "Food Service Establishment Permit. Review these steps before you submit your application. Requirements Checklist. Give a valid email address."
  })

  assert.equal(result.pageVerified, false)
  assert.ok(result.reasons.some(reason => /likely changed/.test(reason)))
  assert.equal(result.checks.email.status, "unknown")
})

test("document signatures are checked from bytes, not a claimed browser type", () => {
  assert.equal(identifySignature(Buffer.from("%PDF-1.7\n")), "pdf")
  assert.equal(identifySignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpeg")
  assert.equal(identifySignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png")
  assert.equal(identifySignature(Buffer.from("<html>not a PDF</html>")), null)
})

test("a document result preserves matching evidence and leaves non-document checks unknown", () => {
  const checklist = makeChecklist({
    textAvailable: true,
    text: "Certificate of Authority to Collect Sales Tax. Food Protection Certificate. Workers' compensation and disability insurance.",
    metadata: {}
  })

  assert.equal(checklist.find(check => check.key === "salesTax").status, "ready")
  assert.equal(checklist.find(check => check.key === "foodProtection").status, "ready")
  assert.equal(checklist.find(check => check.key === "insurance").status, "ready")
  assert.equal(checklist.find(check => check.key === "email").status, "unknown")
  assert.match(checklist.find(check => check.key === "salesTax").evidence, /Certificate of Authority/i)
})

async function withServer(run, options = {}) {
  const {
    snapshotStore = {
      record: async result => ({
        snapshotId: result.sourceFingerprint || "test-snapshot",
        change: "unchanged",
        previousSnapshotId: null,
        observedAt: result.checkedAt || "2026-09-01T00:00:00.000Z"
      }),
      list: async () => []
    },
    ...serverOptions
  } = options
  const server = createServer({ ...serverOptions, snapshotStore })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  try {
    const address = server.address()
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function withApiKey(run) {
  const savedKey = process.env.SOLARI_API_KEY
  process.env.SOLARI_API_KEY = "slr_test_key"
  try {
    await run()
  } finally {
    if (savedKey === undefined) delete process.env.SOLARI_API_KEY
    else process.env.SOLARI_API_KEY = savedKey
  }
}

async function openTestSession(base, accessCode = "test_access") {
  const response = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode })
  })
  const cookie = response.headers.get("set-cookie")
  return { response, cookie: cookie ? cookie.split(";")[0] : null }
}

async function paidCheck(base, cookie) {
  return fetch(`${base}/api/permit-check`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "X-Civra-Action": "permit-check"
    }
  })
}

async function documentCheck(base, cookie, bytes, headers = {}) {
  return fetch(`${base}/api/document-check`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "X-Civra-Action": "document-check",
      "Content-Type": "application/pdf",
      ...headers
    },
    body: bytes
  })
}

function smallPdf(text = "Food Protection Certificate") {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Page >>
endobj
BT (${text}) Tj ET
%%EOF`)
}

test("the server returns the app with strong browser headers", () => withServer(async base => {
  const response = await fetch(`${base}/`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/)
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(response.headers.get("x-frame-options"), "DENY")
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.match(await response.text(), /Civra/)
}))

test("the health check reports non-secret capability readiness", async () => {
  const savedDirectory = process.env.CIVRA_SOURCE_SNAPSHOT_DIR
  delete process.env.CIVRA_SOURCE_SNAPSHOT_DIR
  try {
    await withApiKey(() => withServer(async base => {
      const response = await fetch(`${base}/api/health`)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get("cache-control"), "no-store")
      assert.deepEqual(await response.json(), {
        name: "civra",
        status: "ready",
        capabilities: {
          livePermitChecks: true,
          documentVerification: true,
          sourceSnapshotStorage: "local"
        }
      })
    }, { accessCode: "test_access" }))
  } finally {
    if (savedDirectory === undefined) delete process.env.CIVRA_SOURCE_SNAPSHOT_DIR
    else process.env.CIVRA_SOURCE_SNAPSHOT_DIR = savedDirectory
  }
})

test("health exposes missing live-check configuration without secrets", async () => {
  const savedKey = process.env.SOLARI_API_KEY
  delete process.env.SOLARI_API_KEY
  try {
    await withServer(async base => {
      const response = await fetch(`${base}/api/health`)
      const health = await response.json()
      assert.equal(health.status, "configuration_required")
      assert.equal(health.capabilities.livePermitChecks, false)
      assert.equal(health.capabilities.documentVerification, false)
    }, { accessCode: "test_access" })
  } finally {
    if (savedKey === undefined) delete process.env.SOLARI_API_KEY
    else process.env.SOLARI_API_KEY = savedKey
  }
})

test("the live check fails safely when the server key is missing", async () => {
  const savedKey = process.env.SOLARI_API_KEY
  delete process.env.SOLARI_API_KEY
  try {
    await withServer(async base => {
      const { cookie } = await openTestSession(base)
      const response = await paidCheck(base, cookie)
      assert.equal(response.status, 503)
      assert.equal((await response.json()).code, "SOLARI_KEY_MISSING")
    }, { accessCode: "test_access" })
  } finally {
    if (savedKey) process.env.SOLARI_API_KEY = savedKey
  }
})

test("a live result fails closed when its source snapshot cannot be preserved", () => withApiKey(() => {
  const runCheck = async () => ({
    sourceFingerprint: sourceFingerprint(goodPage),
    pageVerified: true,
    reasons: [],
    checks: {}
  })
  const snapshotStore = {
    record: async () => {
      throw new Error("snapshot volume unavailable")
    }
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const response = await paidCheck(base, cookie)
    assert.equal(response.status, 502)
    assert.equal((await response.json()).code, "SOURCE_SNAPSHOT_FAILED")
  }, { runCheck, snapshotStore, accessCode: "test_access" })
}))

test("unknown files and unsafe methods are rejected", () => withServer(async base => {
  assert.equal((await fetch(`${base}/missing.txt`)).status, 404)
  assert.equal((await fetch(`${base}/`, { method: "POST" })).status, 405)
}))

test("a session reports its remaining paid-check budgets", () => withApiKey(() => {
  const runCheck = async () => ({ pageVerified: true, reasons: [], checks: {} })
  const verifyDocument = async () => ({ ok: true })

  return withServer(async base => {
    const opened = await openTestSession(base)
    const initial = await opened.response.json()
    assert.deepEqual(initial, {
      authenticated: true,
      remainingPermitChecks: 2,
      remainingDocumentChecks: 1
    })

    const permit = await paidCheck(base, opened.cookie)
    assert.equal((await permit.json()).remainingPermitChecks, 1)

    const document = await documentCheck(base, opened.cookie, smallPdf())
    assert.equal((await document.json()).remainingDocumentChecks, 0)

    const current = await fetch(`${base}/api/session`, { headers: { Cookie: opened.cookie } })
    assert.deepEqual(await current.json(), {
      authenticated: true,
      remainingPermitChecks: 1,
      remainingDocumentChecks: 0
    })
  }, {
    runCheck,
    verifyDocument,
    accessCode: "test_access",
    maxPermitChecksPerSession: 2,
    maxDocumentChecksPerSession: 1
  })
}))

test("source history requires a private Civra session and returns public snapshots", () => withServer(async base => {
  const noSession = await fetch(`${base}/api/source-history`)
  assert.equal(noSession.status, 401)
  assert.equal((await noSession.json()).code, "AUTH_REQUIRED")

  const { cookie } = await openTestSession(base)
  const response = await fetch(`${base}/api/source-history`, { headers: { Cookie: cookie } })
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).snapshots, [{
    snapshotId: "a".repeat(64),
    source: PERMIT_URL,
    pageVerified: true
  }])
}, {
  accessCode: "test_access",
  snapshotStore: {
    record: async () => ({ snapshotId: "a".repeat(64), change: "first_observation" }),
    list: async () => [{ snapshotId: "a".repeat(64), source: PERMIT_URL, pageVerified: true }]
  }
}))

test("the paid check requires a private Civra session", () => withApiKey(() => {
  const runCheck = async () => ({ pageVerified: true, reasons: [], checks: {} })
  return withServer(async base => {
    const response = await fetch(`${base}/api/permit-check`, {
      method: "POST",
      headers: { "X-Civra-Action": "permit-check" }
    })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).code, "AUTH_REQUIRED")
  }, { runCheck, accessCode: "test_access" })
}))

test("a valid access code creates a private browser cookie", () => withServer(async base => {
  const denied = await openTestSession(base, "wrong_code")
  assert.equal(denied.response.status, 401)

  const allowed = await openTestSession(base)
  assert.equal(allowed.response.status, 200)
  const fullCookie = allowed.response.headers.get("set-cookie")
  assert.match(fullCookie, /HttpOnly/)
  assert.match(fullCookie, /SameSite=Strict/)
  assert.ok(allowed.cookie)
}, { accessCode: "test_access" }))

test("repeated wrong access codes start a login cooldown", () => withServer(async base => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const denied = await openTestSession(base, "wrong_code")
    assert.equal(denied.response.status, 401)
  }

  const blocked = await openTestSession(base, "wrong_code")
  assert.equal(blocked.response.status, 429)
  assert.equal((await blocked.response.json()).code, "LOGIN_COOLDOWN")
  assert.ok(Number(blocked.response.headers.get("retry-after")) >= 1)
}, { accessCode: "test_access" }))

test("an open session still needs the trusted action header", () => withApiKey(() => {
  const runCheck = async () => ({ pageVerified: true, reasons: [], checks: {} })
  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const response = await fetch(`${base}/api/permit-check`, {
      method: "POST",
      headers: { Cookie: cookie }
    })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, "ACTION_HEADER_REQUIRED")
  }, { runCheck, accessCode: "test_access" })
}))

test("cross-site browser requests cannot trigger paid permit checks", () => withApiKey(() => {
  let calls = 0
  const runCheck = async () => {
    calls += 1
    return { pageVerified: true, reasons: [], checks: {} }
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const blocked = await fetch(`${base}/api/permit-check`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://untrusted.example",
        "X-Civra-Action": "permit-check"
      }
    })
    assert.equal(blocked.status, 403)
    assert.equal((await blocked.json()).code, "UNTRUSTED_ORIGIN")
    assert.equal(calls, 0)

    const allowed = await fetch(`${base}/api/permit-check`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        "X-Civra-Action": "permit-check"
      }
    })
    assert.equal(allowed.status, 200)
    assert.equal(calls, 1)
  }, { runCheck, accessCode: "test_access" })
}))

test("document checks require the same private session and explicit action", () => withApiKey(() => {
  const verifyDocument = async () => ({ ok: true })
  return withServer(async base => {
    const noSession = await fetch(`${base}/api/document-check`, {
      method: "POST",
      headers: { "X-Civra-Action": "document-check" },
      body: smallPdf()
    })
    assert.equal(noSession.status, 401)

    const { cookie } = await openTestSession(base)
    const noAction = await fetch(`${base}/api/document-check`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: smallPdf()
    })
    assert.equal(noAction.status, 403)
  }, { verifyDocument, accessCode: "test_access" })
}))

test("document checks reject a false PDF type before a sandbox can run", () => withApiKey(() => {
  let calls = 0
  const verifyDocument = async () => {
    calls += 1
    return { ok: true }
  }
  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const response = await documentCheck(base, cookie, Buffer.from("<script>not a PDF</script>"))
    assert.equal(response.status, 415)
    assert.equal((await response.json()).code, "UNSUPPORTED_DOCUMENT")
    assert.equal(calls, 0)
  }, { verifyDocument, accessCode: "test_access" })
}))

test("a signature-verified upload is processed without writing a local file", () => withApiKey(() => {
  const result = {
    document: { format: "PDF", mediaType: "application/pdf", bytes: 55, metadata: {}, textExtracted: true },
    source: { url: PERMIT_URL, checkedAt: "2026-09-01T00:26:13.852Z" },
    requirementVersion: "nyc-food-service-2026-09-01",
    summary: { ready: 1, missing: 2, unknown: 1 },
    checklist: [],
    retention: "The original file was processed in an ephemeral sandbox and deleted when that sandbox was destroyed."
  }
  let received
  const verifyDocument = async ({ apiKey, bytes }) => {
    received = { apiKey, bytes: Buffer.from(bytes) }
    return result
  }
  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const response = await documentCheck(base, cookie, smallPdf())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), result)
    assert.equal(received.apiKey, "slr_test_key")
    assert.equal(identifySignature(received.bytes), "pdf")
  }, { verifyDocument, accessCode: "test_access" })
}))

test("document checks are metered per session and serialize sandbox work", () => withApiKey(() => {
  let calls = 0
  const verifyDocument = async () => {
    calls += 1
    await wait(30)
    return { ok: true }
  }
  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const [first, second] = await Promise.all([
      documentCheck(base, cookie, smallPdf("Food Protection Certificate")),
      documentCheck(base, cookie, smallPdf("Certificate of Authority"))
    ])
    const statuses = [first.status, second.status].sort()
    assert.deepEqual(statuses, [200, 429])
    assert.equal(calls, 1)

    const limited = await documentCheck(base, cookie, smallPdf())
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).code, "DOCUMENT_CHECK_LIMIT")
  }, {
    verifyDocument,
    accessCode: "test_access",
    maxDocumentChecksPerSession: 1
  })
}))

test("a second request is served from cache without a new paid check", () => withApiKey(() => {
  let calls = 0
  const runCheck = async () => {
    calls += 1
    return { pageVerified: true, reasons: [], checks: {} }
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const first = await paidCheck(base, cookie)
    assert.equal(first.status, 200)
    assert.equal((await first.json()).fromCache, false)

    const second = await paidCheck(base, cookie)
    assert.equal(second.status, 200)
    assert.equal((await second.json()).fromCache, true)

    assert.equal(calls, 1)
  }, { runCheck, accessCode: "test_access" })
}))

test("live permit checks are metered per session", () => withApiKey(() => {
  let calls = 0
  const runCheck = async () => {
    calls += 1
    return { pageVerified: true, reasons: [], checks: {} }
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const first = await paidCheck(base, cookie)
    assert.equal(first.status, 200)

    const limited = await paidCheck(base, cookie)
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).code, "PERMIT_CHECK_LIMIT")
    assert.equal(calls, 1)
  }, {
    runCheck,
    cacheMs: 0,
    accessCode: "test_access",
    maxPermitChecksPerSession: 1
  })
}))

test("concurrent requests share one live check instead of two launches", () => withApiKey(() => {
  let calls = 0
  const runCheck = async () => {
    calls += 1
    await wait(30)
    return { pageVerified: true, reasons: [], checks: {} }
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const [first, second] = await Promise.all([
      paidCheck(base, cookie),
      paidCheck(base, cookie)
    ])
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(calls, 1)
  }, {
    runCheck,
    accessCode: "test_access",
    maxPermitChecksPerSession: 1
  })
}))

test("a failed check answers 502 and then cools down with 429", () => withApiKey(() => {
  let calls = 0
  const runCheck = async () => {
    calls += 1
    throw new Error("solari unreachable")
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    const failed = await paidCheck(base, cookie)
    assert.equal(failed.status, 502)
    assert.equal((await failed.json()).code, "PERMIT_CHECK_FAILED")

    const throttled = await paidCheck(base, cookie)
    assert.equal(throttled.status, 429)
    assert.equal((await throttled.json()).code, "CHECK_COOLDOWN")
    assert.ok(Number(throttled.headers.get("retry-after")) >= 1)

    assert.equal(calls, 1)
  }, { runCheck, cooldownMs: 60000, accessCode: "test_access" })
}))

test("after the cooldown passes, the check is allowed to run again", () => withApiKey(() => {
  let calls = 0
  const runCheck = async () => {
    calls += 1
    if (calls === 1) throw new Error("first try fails")
    return { pageVerified: true, reasons: [], checks: {} }
  }

  return withServer(async base => {
    const { cookie } = await openTestSession(base)
    assert.equal((await paidCheck(base, cookie)).status, 502)
    const retried = await paidCheck(base, cookie)
    assert.equal(retried.status, 200)
    assert.equal(calls, 2)
  }, { runCheck, cooldownMs: 0, accessCode: "test_access" })
}))
