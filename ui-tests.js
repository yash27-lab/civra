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
}) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost:4173/"
  })
  const { window } = dom
  window.fetch = fetchImpl
  window.scrollTo = () => undefined
  window.requestAnimationFrame = callback => callback()
  window.HTMLElement.prototype.scrollIntoView = () => undefined
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
          textExtracted: true
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
  assert.match(document.querySelector("#documentReport").textContent, /original file was processed/i)
  assert.equal(document.querySelector("#ownerFile").value, "")

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
      return jsonResponse({ authenticated: true })
    }
    if (url === "/api/session" && options.method === "DELETE") {
      return jsonResponse({ authenticated: false })
    }
    if (url === "/api/permit-check") {
      return jsonResponse({
        pageVerified: true,
        fromCache: false,
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

  document.querySelector("#liveCheck").click()
  await nextTurn()
  assert.match(document.querySelector("#liveStatus").textContent, /All 4 permit needs/)
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
