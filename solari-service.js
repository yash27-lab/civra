const { PERMIT_URL, requirementSet } = require("./permit-requirements")

const checks = requirementSet.requirements

// Markers that identify the permit page itself, separate from the permit
// needs above. If any marker is gone the page has changed shape and no
// check result can be trusted.
const pageMarkers = [
  "food service establishment permit",
  "review these steps before you submit your application",
  "requirements checklist"
]

// The page currently lists all four needs. If fewer than this many phrases
// survive, the city rewrote the page rather than dropped requirements.
const minPhrasesForTrust = 2

function excerpt(text, lowerBody, lowerPhrase) {
  const at = lowerBody.indexOf(lowerPhrase)
  if (at === -1) return null
  const start = Math.max(0, at - 60)
  const end = Math.min(text.length, at + lowerPhrase.length + 60)
  return text.slice(start, end).replace(/\s+/g, " ").trim()
}

// Fail closed: any doubt about the page means every check is "unknown",
// never a silent "missing".
function evaluatePermitPage({ finalUrl, title, text }) {
  const reasons = []
  const lowerBody = (text || "").toLowerCase()

  const finalBase = String(finalUrl || "").split(/[?#]/)[0].replace(/\/+$/, "")
  if (finalBase !== PERMIT_URL) {
    reasons.push("The browser ended on a different address than the official permit page.")
  }

  if (!/food service/i.test(title || "")) {
    reasons.push("The page title does not look like the food service permit page.")
  }

  const missingMarkers = pageMarkers.filter(marker => !lowerBody.includes(marker))
  if (missingMarkers.length > 0) {
    reasons.push(`Expected page sections are missing: ${missingMarkers.join(", ")}.`)
  }

  const phrasesFound = checks.filter(({ phrase }) => lowerBody.includes(phrase.toLowerCase())).length
  if (phrasesFound < minPhrasesForTrust) {
    reasons.push(`Only ${phrasesFound} of ${checks.length} known permit needs appear, so the page has likely changed.`)
  }

  const pageVerified = reasons.length === 0
  const results = Object.fromEntries(
    checks.map(({ key, phrase }) => {
      if (!pageVerified) return [key, { status: "unknown", evidence: null }]
      const evidence = excerpt(text, lowerBody, phrase.toLowerCase())
      return [key, evidence ? { status: "found", evidence } : { status: "missing", evidence: null }]
    })
  )

  return { pageVerified, reasons, checks: results }
}

async function runPermitCheck({ apiKey }) {
  if (!apiKey) throw new Error("A Solari API key is required")

  const { Solari } = await import("@solarisdk/browser")
  const solari = new Solari({ apiKey })
  let browser

  try {
    browser = await solari.launch({ recording: true })
    const page = await browser.newPage()
    await page.goto(PERMIT_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.getByText("How To Apply", { exact: true }).first().click()
    await page.waitForTimeout(750)
    const finalUrl = page.url()
    const title = await page.title()
    const text = await page.locator("body").innerText()

    return {
      checkedAt: new Date().toISOString(),
      source: PERMIT_URL,
      finalUrl,
      title,
      ...evaluatePermitPage({ finalUrl, title, text })
    }
  } finally {
    if (browser) await browser.close()
    await solari.close().catch(() => undefined)
  }
}

module.exports = { PERMIT_URL, evaluatePermitPage, runPermitCheck }
