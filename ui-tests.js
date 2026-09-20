const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const { JSDOM } = require("jsdom")

const html = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
const script = fs.readFileSync(path.join(__dirname, "public", "app.js"), "utf8")

function jsonResponse(value, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => value }
}

function loadPage(fetchImpl = async url => {
  if (url === "/api/session") return jsonResponse({ authenticated: false })
  return jsonResponse({ message: "Not ready" }, { ok: false, status: 503 })
}, prepareWindow = () => undefined) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost:4173/"
  })
  const { window } = dom
  window.fetch = fetchImpl
  window.scrollTo = () => undefined
  window.requestAnimationFrame = callback => callback()
  window.HTMLElement.prototype.scrollIntoView = () => undefined
  prepareWindow(window)
  window.eval(script)
  return dom
}

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve))
}

test("main menu, task, guide, and add permit actions work", async () => {
  const dom = loadPage()
  const { document, Event } = dom.window
  await nextTurn()

  document.querySelector('[data-page="files"]').click()
  assert.ok(document.querySelector("#sheet").classList.contains("show"))
  document.querySelector("#closeButton").click()
  assert.ok(!document.querySelector("#sheet").classList.contains("show"))

  document.querySelector("#helpButton").click()
  assert.equal(document.querySelector("#tourCount").textContent, "Step 1 of 6")
  document.querySelector("#tourNext").click()
  assert.equal(document.querySelector("#tourCount").textContent, "Step 2 of 6")
  document.querySelector("#tourBack").click()
  assert.equal(document.querySelector("#tourCount").textContent, "Step 1 of 6")
  document.querySelector("#closeGuide").click()

  document.querySelector("#addPermit").click()
  document.querySelector("#newPermitName").value = "Sidewalk Cafe Permit"
  document.querySelector("#newPermitDate").value = "2026-11-15"
  document.querySelector("#addPermitForm").dispatchEvent(new Event("submit", {
    bubbles: true,
    cancelable: true
  }))
  assert.match(document.querySelector("#permitsCard").textContent, /Sidewalk Cafe Permit/)

  dom.window.close()
})

test("renewal review prioritizes owner action and tracks added permits", async () => {
  const dom = loadPage(undefined, window => {
    window.localStorage.setItem("civra_renewals_v1", JSON.stringify([
      { name: "Stored Health Permit", dueDate: "2026-09-18" }
    ]))
  })
  const { document, Event } = dom.window
  await nextTurn()

  assert.match(document.querySelector("#renewalQueue").textContent, /Stored Health Permit/)
  assert.match(document.querySelector("#renewalSummary").textContent, /owner review/i)

  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  document.querySelector("#addPermit").click()
  document.querySelector("#newPermitName").value = "Sidewalk Cafe Permit"
  document.querySelector("#newPermitDate").value = due
  document.querySelector("#addPermitForm").dispatchEvent(new Event("submit", {
    bubbles: true,
    cancelable: true
  }))

  assert.match(document.querySelector("#renewalQueue").textContent, /Sidewalk Cafe Permit/)
  assert.match(document.querySelector("#renewalQueue").textContent, /Review now/)
  assert.match(document.querySelector("#renewalQueue").textContent, /Stored Health Permit/)
  assert.match(dom.window.localStorage.getItem("civra_renewals_v1"), /Sidewalk Cafe Permit/)
  document.querySelector("#clearRenewals").click()
  assert.equal(dom.window.localStorage.getItem("civra_renewals_v1"), null)
  assert.ok(!document.querySelector("#renewalQueue").textContent.includes("Sidewalk Cafe Permit"))
  document.querySelector('[data-page="renewals"]').click()
  assert.ok(document.querySelector('[data-page="renewals"]').classList.contains("active"))

  dom.window.close()
})

test("renewal calendar export creates owner-review events", async () => {
  const dom = loadPage()
  await nextTurn()

  const calendar = dom.window.buildRenewalCalendar([{
    name: "Café, Inc; Permit",
    dueDate: "2026-12-31"
  }])

  assert.match(calendar, /^BEGIN:VCALENDAR\r\nVERSION:2.0/m)
  assert.match(calendar, /SUMMARY:Review renewal: Café\\, Inc\\; Permit/)
  assert.match(calendar, /DTSTART;VALUE=DATE:\d{8}/)
  assert.match(calendar, /DESCRIPTION:Created locally by Civra/)
  assert.match(calendar, /END:VCALENDAR\r\n$/)

  dom.window.close()
})

test("document selection does not trust browser MIME and requires an unlocked session", async () => {
  const dom = loadPage()
  const { document, Event, File } = dom.window
  await nextTurn()

  const input = document.querySelector("#ownerFile")
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["safe"], "permit.pdf", { type: "application/pdf" })]
  })
  input.dispatchEvent(new Event("change"))
  assert.equal(document.querySelector("#continueButton").disabled, true)
  assert.match(document.querySelector("#fileOk").textContent, /permit\.pdf is ready/)

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["bad"], "script.html", { type: "text/html" })]
  })
  input.dispatchEvent(new Event("change"))
  assert.equal(document.querySelector("#continueButton").disabled, true)
  assert.match(document.querySelector("#fileOk").textContent, /real file signature/)

  dom.window.close()
})

test("an unlocked owner can verify a document and review its evidence", async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === "/api/session" && !options.method) return jsonResponse({ authenticated: true })
    if (url === "/api/document-check") {
      return jsonResponse({
        document: {
          format: "PDF",
          mediaType: "application/pdf",
          bytes: 37,
          metadata: { pageCount: 1 },
          textExtracted: true,
          textMethod: "flate-literal"
        },
        source: {
          url: "https://example.com/official",
          checkedAt: "2026-09-01T00:26:13.852Z"
        },
        requirementVersion: "nyc-food-service-2026-09-01",
        summary: { ready: 1, missing: 2, unknown: 1 },
        checklist: [{
          key: "foodProtection",
          label: "Food Protection Certificate",
          status: "ready",
          evidence: "Food Protection Certificate 123",
          reason: "Matching document evidence was found."
        }],
        retention: "The original file was processed in an ephemeral sandbox and deleted when that sandbox was destroyed."
      })
    }
    return jsonResponse({}, { ok: false, status: 404 })
  }

  const dom = loadPage(fetchImpl)
  const { document, Event, File } = dom.window
  await nextTurn()

  const input = document.querySelector("#ownerFile")
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["%PDF-1.7"], "certificate.pdf", { type: "text/html" })]
  })
  input.dispatchEvent(new Event("change"))
  assert.equal(document.querySelector("#continueButton").disabled, false)

  document.querySelector("#continueButton").click()
  await nextTurn()
  await nextTurn()
  const documentCall = calls.find(call => call.url === "/api/document-check")
  assert.equal(documentCall.options.headers["X-Civra-Action"], "document-check")
  assert.equal(documentCall.options.headers["Content-Type"], "application/octet-stream")
  assert.match(document.querySelector("#documentReport").textContent, /Food Protection Certificate/)
  assert.match(document.querySelector("#documentReport").textContent, /flate-literal/)
  assert.match(document.querySelector("#documentReport").textContent, /original file was processed/i)
  assert.equal(document.querySelector("#ownerFile").value, "")

  dom.window.close()
})

test("an unlocked owner can review recorded source history", async () => {
  const fetchImpl = async (url, options = {}) => {
    if (url === "/api/session" && !options.method) return jsonResponse({ authenticated: true })
    if (url === "/api/source-history") {
      return jsonResponse({
        snapshots: [{
          snapshotId: "0123456789abcdef".repeat(4),
          title: "Food Service Establishment Permit - NYC Business",
          pageVerified: true,
          lastObservedAt: "2026-09-12T09:00:00.000Z"
        }]
      })
    }
    return jsonResponse({}, { ok: false, status: 404 })
  }

  const dom = loadPage(fetchImpl)
  await nextTurn()
  await nextTurn()

  const { document } = dom.window
  assert.match(document.querySelector("#sourceHistoryStatus").textContent, /1 recorded source snapshot/)
  assert.match(document.querySelector("#sourceHistoryList").textContent, /Food Service Establishment Permit/)
  assert.match(document.querySelector("#sourceHistoryList").textContent, /Verified/)
  assert.match(document.querySelector("#sourceHistoryList").textContent, /0123456789ab/)

  dom.window.close()
})

test("source history opens only the selected recorded evidence", async () => {
  const snapshotId = "a".repeat(64)
  const calls = []
  const fetchImpl = async url => {
    calls.push(url)
    if (url === "/api/session") return jsonResponse({ authenticated: true })
    if (url === "/api/source-history") {
      return jsonResponse({ snapshots: [{
        snapshotId,
        title: "Food Service Establishment Permit - NYC Business",
        pageVerified: true,
        lastObservedAt: "2026-09-12T09:00:00.000Z"
      }] })
    }
    if (url === "/api/source-history/" + snapshotId) {
      return jsonResponse({ snapshot: {
        snapshotId,
        sourceFingerprint: snapshotId,
        source: "https://example.com/official",
        pageVerified: true,
        checks: {
          salesTax: {
            label: "Sales tax proof",
            status: "found",
            reason: "Matched official page language.",
            evidence: "Certificate of Authority to Collect Sales Tax."
          }
        }
      } })
    }
    return jsonResponse({}, { ok: false, status: 404 })
  }

  const dom = loadPage(fetchImpl)
  await nextTurn()
  await nextTurn()
  dom.window.document.querySelector(".sourcehistorybutton").click()
  await nextTurn()
  await nextTurn()

  const { document } = dom.window
  assert.equal(document.querySelector("#sourceEvidence").hidden, false)
  assert.match(document.querySelector("#sourceEvidence").textContent, /Sales tax proof/)
  assert.match(document.querySelector("#sourceEvidence").textContent, /Certificate of Authority/)
  assert.equal(document.querySelector("#sourceEvidenceLink").href, "https://example.com/official")
  assert.ok(calls.includes("/api/source-history/" + snapshotId))

  document.querySelector("#closeSourceEvidence").click()
  assert.equal(document.querySelector("#sourceEvidence").hidden, true)
  dom.window.close()
})

test("access code unlocks the paid check and lock closes it", async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === "/api/session" && !options.method) {
      return jsonResponse({ authenticated: false })
    }
    if (url === "/api/session" && options.method === "POST") {
      return jsonResponse({
        authenticated: true,
        remainingPermitChecks: 2,
        remainingDocumentChecks: 1
      })
    }
    if (url === "/api/session" && options.method === "DELETE") {
      return jsonResponse({ authenticated: false })
    }
    if (url === "/api/permit-check") {
      return jsonResponse({
        pageVerified: true,
        fromCache: false,
        remainingPermitChecks: 1,
        checks: {
          one: { status: "found" },
          two: { status: "found" },
          three: { status: "found" },
          four: { status: "found" }
        }
      })
    }
    return jsonResponse({}, { ok: false, status: 404 })
  }

  const dom = loadPage(fetchImpl)
  const { document, Event } = dom.window
  await nextTurn()
  assert.equal(document.querySelector("#liveCheck").disabled, true)

  document.querySelector("#accessCode").value = "private code"
  document.querySelector("#accessForm").dispatchEvent(new Event("submit", {
    bubbles: true,
    cancelable: true
  }))
  await nextTurn()
  assert.equal(document.querySelector("#liveCheck").disabled, false)
  assert.match(document.querySelector("#liveStatus").textContent, /2 live permit checks remain/)

  document.querySelector("#liveCheck").click()
  await nextTurn()
  assert.match(document.querySelector("#liveStatus").textContent, /All 4 permit needs/)
  assert.match(document.querySelector("#liveStatus").textContent, /1 live permit check remains/)
  const paidCall = calls.find(call => call.url === "/api/permit-check")
  assert.equal(paidCall.options.headers["X-Civra-Action"], "permit-check")

  document.querySelector("#signOut").click()
  await nextTurn()
  assert.equal(document.querySelector("#liveCheck").disabled, true)

  dom.window.close()
})

test("saved live proof is shown without spending a new browser run", async () => {
  const fetchImpl = async url => {
    if (url === "/api/session") return jsonResponse({ authenticated: false })
    if (url === "/live-proof.json") {
      return jsonResponse({
        checkedAt: "2026-09-01T00:26:13.852Z",
        source: "https://example.com/official",
        pageVerified: true,
        checks: {
          one: { status: "found" },
          two: { status: "found" },
          three: { status: "found" },
          four: { status: "found" }
        }
      })
    }
    return jsonResponse({}, { ok: false, status: 404 })
  }

  const dom = loadPage(fetchImpl)
  await nextTurn()
  assert.match(dom.window.document.querySelector("#proofSummary").textContent, /4 of 4 needs found/)
  assert.equal(dom.window.document.querySelector("#proofSource").href, "https://example.com/official")
  dom.window.close()
})
