const PERMIT_URL = "https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit"

// This is a deliberately small, versioned requirement set. The source snapshot
// is the recorded browser run published with this release, not an AI summary.
// A document match means only that this one document contains the listed
// signals; it never authorizes a permit submission.
const requirementSet = Object.freeze({
  version: "nyc-food-service-2026-09-01",
  source: Object.freeze({
    url: PERMIT_URL,
    checkedAt: "2026-09-01T00:26:13.852Z",
    proof: "/live-proof.json"
  }),
  requirements: Object.freeze([
    Object.freeze({
      key: "salesTax",
      label: "Certificate of Authority to Collect Sales Tax",
      phrase: "Certificate of Authority to Collect Sales Tax",
      documentSignals: Object.freeze([Object.freeze([
        "certificate of authority",
        "sales tax certificate"
      ])])
    }),
    Object.freeze({
      key: "foodProtection",
      label: "Food Protection Certificate",
      phrase: "Food Protection Certificate",
      documentSignals: Object.freeze([Object.freeze(["food protection certificate"])])
    }),
    Object.freeze({
      key: "insurance",
      label: "Workers' compensation and disability insurance",
      phrase: "workers' compensation and disability insurance",
      // Both concepts are needed before Civra can call a document match ready.
      documentSignals: Object.freeze([
        Object.freeze(["workers compensation", "workers' compensation"]),
        Object.freeze(["disability insurance", "disability benefits"])
      ])
    }),
    Object.freeze({
      key: "email",
      label: "Valid email address",
      phrase: "valid email address",
      documentSignals: null
    })
  ])
})

module.exports = { PERMIT_URL, requirementSet }
