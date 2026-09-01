const http = require("http")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { runPermitCheck } = require("./solari-service")
const { MAX_FILE_BYTES, identifySignature, runDocumentVerification } = require("./document-verification-service")

const root = path.resolve(__dirname, "public")
const defaultPort = Number(process.env.PORT || 4173)

// Every live check launches a paid Solari browser, so the endpoint is
// metered: one shared result is cached, concurrent requests join the same
// run, and failures pause new spending for a cooldown window.
const defaultCacheMs = 15 * 60 * 1000
const defaultCooldownMs = 60 * 1000
const defaultSessionMs = 60 * 60 * 1000
const loginWindowMs = 5 * 60 * 1000
const maxLoginFailures = 5
const defaultDocumentChecksPerSession = 3
const defaultDocumentChecksInFlight = 1

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
}

const safetyHeaders = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { ...safetyHeaders, ...headers })
  response.end(body)
}

function sendJson(response, status, value, headers = {}) {
  send(response, status, JSON.stringify(value), {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  })
}

function readBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(request.headers["content-length"])
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      reject(new Error("REQUEST_TOO_LARGE"))
      return
    }

    let size = 0
    const chunks = []
    let finished = false

    request.on("data", chunk => {
      if (finished) return
      size += chunk.length
      if (size > maxBytes) {
        finished = true
        reject(new Error("REQUEST_TOO_LARGE"))
        return
      }
      chunks.push(chunk)
    })
    request.on("end", () => {
      if (finished) return
      finished = true
      resolve(Buffer.concat(chunks))
    })
    request.on("error", error => {
      if (finished) return
      finished = true
      reject(error)
    })
  })
}

async function readJson(request, maxBytes = 2048) {
  const body = await readBody(request, maxBytes)
  try {
    return JSON.parse(body.toString("utf8") || "{}")
  } catch {
    throw new Error("BAD_JSON")
  }
}

function sameSecret(value, expected) {
  const left = Buffer.from(String(value || ""))
  const right = Buffer.from(String(expected || ""))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function readCookie(request, name) {
  const cookies = String(request.headers.cookie || "").split(";")
  for (const item of cookies) {
    const [key, ...value] = item.trim().split("=")
    if (key === name) return value.join("=")
  }
  return null
}

function createServer({
  runCheck = runPermitCheck,
  verifyDocument = runDocumentVerification,
  cacheMs = defaultCacheMs,
  cooldownMs = defaultCooldownMs,
  accessCode = process.env.CIVRA_ACCESS_CODE,
  sessionMs = defaultSessionMs,
  maxDocumentChecksPerSession = defaultDocumentChecksPerSession,
  maxDocumentChecksInFlight = defaultDocumentChecksInFlight
} = {}) {
  let cached = null
  let inFlight = null
  let cooldownUntil = 0
  let documentChecksInFlight = 0
  const sessions = new Map()
  const loginFailures = new Map()

  function getSession(request) {
    const token = readCookie(request, "civra_session")
    if (!token) return null
    const session = sessions.get(token)
    if (!session || Date.now() >= session.expiresAt) {
      sessions.delete(token)
      return null
    }
    return token
  }

  function sessionCookie(token, maxAge) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
    return `civra_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
  }

  async function openSession(request, response) {
    if (!accessCode) {
      sendJson(response, 503, {
        code: "ACCESS_CODE_MISSING",
        message: "Add CIVRA_ACCESS_CODE on the server before using the paid check."
      })
      return
    }

    const client = request.socket.remoteAddress || "unknown"
    const failure = loginFailures.get(client)
    if (failure && failure.count >= maxLoginFailures && Date.now() < failure.resetAt) {
      const retryAfter = Math.ceil((failure.resetAt - Date.now()) / 1000)
      sendJson(response, 429, {
        code: "LOGIN_COOLDOWN",
        message: `Too many access attempts. Please try again in ${retryAfter} seconds.`
      }, { "Retry-After": String(retryAfter) })
      return
    }

    let body
    try {
      body = await readJson(request)
    } catch (error) {
      const tooLarge = error.message === "REQUEST_TOO_LARGE"
      sendJson(response, tooLarge ? 413 : 400, {
        code: tooLarge ? "REQUEST_TOO_LARGE" : "BAD_JSON",
        message: tooLarge ? "The request is too large." : "Send a valid JSON request."
      })
      return
    }

    if (!sameSecret(body.accessCode, accessCode)) {
      const current = failure && Date.now() < failure.resetAt ? failure.count : 0
      loginFailures.set(client, { count: current + 1, resetAt: Date.now() + loginWindowMs })
      sendJson(response, 401, {
        code: "ACCESS_DENIED",
        message: "The Civra access code was not accepted."
      })
      return
    }

    loginFailures.delete(client)
    const token = crypto.randomBytes(32).toString("base64url")
    sessions.set(token, { expiresAt: Date.now() + sessionMs, documentChecks: 0 })
    sendJson(response, 200, { authenticated: true }, {
      "Set-Cookie": sessionCookie(token, Math.floor(sessionMs / 1000))
    })
  }

  async function handlePermitCheck(response) {
    if (!process.env.SOLARI_API_KEY) {
      sendJson(response, 503, {
        code: "SOLARI_KEY_MISSING",
        message: "Add SOLARI_API_KEY on the server to run the live permit check."
      })
      return
    }

    const now = Date.now()

    if (cached && now < cached.expiresAt) {
      sendJson(response, 200, { ...cached.value, fromCache: true })
      return
    }

    if (now < cooldownUntil) {
      const retryAfter = Math.ceil((cooldownUntil - now) / 1000)
      sendJson(response, 429, {
        code: "CHECK_COOLDOWN",
        message: `A recent check failed. Please try again in ${retryAfter} seconds.`
      }, { "Retry-After": String(retryAfter) })
      return
    }

    if (!inFlight) {
      inFlight = runCheck({ apiKey: process.env.SOLARI_API_KEY }).finally(() => {
        inFlight = null
      })
    }

    try {
      const result = await inFlight
      cached = { value: result, expiresAt: Date.now() + cacheMs }
      sendJson(response, 200, { ...result, fromCache: false })
    } catch (error) {
      cooldownUntil = Date.now() + cooldownMs
      console.error("Permit check failed", error instanceof Error ? error.message : error)
      sendJson(response, 502, {
        code: "PERMIT_CHECK_FAILED",
        message: "The permit page could not be checked. Please try again."
      })
    }
  }

  async function handleDocumentCheck(request, response) {
    if (!process.env.SOLARI_API_KEY) {
      sendJson(response, 503, {
        code: "SOLARI_KEY_MISSING",
        message: "Add SOLARI_API_KEY on the server before using document verification."
      })
      return
    }

    if (documentChecksInFlight >= maxDocumentChecksInFlight) {
      sendJson(response, 429, {
        code: "DOCUMENT_CHECK_BUSY",
        message: "A document is already being checked. Please wait for it to finish."
      }, { "Retry-After": "10" })
      return
    }

    let bytes
    try {
      bytes = await readBody(request, MAX_FILE_BYTES)
    } catch (error) {
      const tooLarge = error && error.message === "REQUEST_TOO_LARGE"
      sendJson(response, tooLarge ? 413 : 400, {
        code: tooLarge ? "REQUEST_TOO_LARGE" : "BAD_REQUEST",
        message: tooLarge ? "The uploaded file is too large. Use a file under 10 MB." : "Civra could not read this upload."
      })
      return
    }

    // Verify magic bytes on the Civra server before a file can reach Solari.
    // The sandbox verifies the same signature again before it extracts anything.
    if (!identifySignature(bytes)) {
      sendJson(response, 415, {
        code: "UNSUPPORTED_DOCUMENT",
        message: "Civra could not verify a PDF, JPEG, or PNG file signature."
      })
      return
    }

    const token = getSession(request)
    const session = token ? sessions.get(token) : null
    if (!session || session.documentChecks >= maxDocumentChecksPerSession) {
      sendJson(response, 429, {
        code: "DOCUMENT_CHECK_LIMIT",
        message: "This Civra session has reached its document-check limit. Start a new owner-reviewed session before checking more files."
      })
      return
    }

    // A second check is necessary after the asynchronous body read. Two uploads
    // can both arrive while no sandbox has been launched yet.
    if (documentChecksInFlight >= maxDocumentChecksInFlight) {
      sendJson(response, 429, {
        code: "DOCUMENT_CHECK_BUSY",
        message: "A document is already being checked. Please wait for it to finish."
      }, { "Retry-After": "10" })
      return
    }

    session.documentChecks += 1
    documentChecksInFlight += 1
    try {
      const result = await verifyDocument({ apiKey: process.env.SOLARI_API_KEY, bytes })
      sendJson(response, 200, result)
    } catch (error) {
      console.error("Document verification failed", error instanceof Error ? error.message : error)
      sendJson(response, 502, {
        code: "DOCUMENT_CHECK_FAILED",
        message: "Civra could not safely inspect this file. Nothing was submitted. Try a different file or review it yourself."
      })
    } finally {
      documentChecksInFlight -= 1
    }
  }

  async function handleApi(request, response, pathname) {
    if (pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, { name: "civra", status: "ready" })
      return true
    }

    if (pathname === "/api/session" && request.method === "GET") {
      sendJson(response, 200, { authenticated: Boolean(getSession(request)) })
      return true
    }

    if (pathname === "/api/session" && request.method === "POST") {
      await openSession(request, response)
      return true
    }

    if (pathname === "/api/session" && request.method === "DELETE") {
      const token = getSession(request)
      if (token) sessions.delete(token)
      sendJson(response, 200, { authenticated: false }, {
        "Set-Cookie": sessionCookie("", 0)
      })
      return true
    }

    if (pathname === "/api/permit-check" && request.method === "POST") {
      if (!getSession(request)) {
        sendJson(response, 401, {
          code: "AUTH_REQUIRED",
          message: "Unlock the live check with the Civra access code."
        })
        return true
      }
      if (request.headers["x-civra-action"] !== "permit-check") {
        sendJson(response, 403, {
          code: "ACTION_HEADER_REQUIRED",
          message: "The paid check needs an explicit Civra request."
        })
        return true
      }
      await handlePermitCheck(response)
      return true
    }

    if (pathname === "/api/document-check" && request.method === "POST") {
      if (!getSession(request)) {
        sendJson(response, 401, {
          code: "AUTH_REQUIRED",
          message: "Unlock document verification with the Civra access code."
        })
        return true
      }
      if (request.headers["x-civra-action"] !== "document-check") {
        sendJson(response, 403, {
          code: "ACTION_HEADER_REQUIRED",
          message: "Document verification needs an explicit Civra request."
        })
        return true
      }
      await handleDocumentCheck(request, response)
      return true
    }

    if (pathname.startsWith("/api/")) {
      sendJson(response, 404, { code: "NOT_FOUND", message: "API route not found." })
      return true
    }

    return false
  }

  return http.createServer(async (request, response) => {
    let pathname
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname)
    } catch {
      send(response, 400, "Bad request")
      return
    }

    if (await handleApi(request, response, pathname)) return

    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "Method not allowed", { Allow: "GET, HEAD" })
      return
    }

    const route = pathname === "/" ? "/index.html" : pathname
    const file = path.resolve(root, `.${route}`)

    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      send(response, 403, "Not allowed")
      return
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        send(response, 404, "Not found")
        return
      }

      const extension = path.extname(file)
      response.writeHead(200, {
        ...safetyHeaders,
        "Cache-Control": "no-store",
        "Content-Type": types[extension] || "application/octet-stream"
      })
      response.end(request.method === "HEAD" ? undefined : data)
    })
  })
}

if (require.main === module) {
  createServer().listen(defaultPort, () => {
    console.log(`Civra is ready at http://localhost:${defaultPort}`)
  })
}

module.exports = { createServer, safetyHeaders }
