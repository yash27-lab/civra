const sheet = document.querySelector("#sheet")
const fileInput = document.querySelector("#ownerFile")
const fileOk = document.querySelector("#fileOk")
const continueButton = document.querySelector("#continueButton")
const guide = document.querySelector("#guide")
const tourTitle = document.querySelector("#tourTitle")
const tourText = document.querySelector("#tourText")
const tourDemo = document.querySelector("#tourDemo")
const tourCount = document.querySelector("#tourCount")
const tourIcon = document.querySelector("#tourIcon")
const tourBar = document.querySelector("#tourBar")
const tourBack = document.querySelector("#tourBack")
const tourNext = document.querySelector("#tourNext")
const liveCheck = document.querySelector("#liveCheck")
const liveStatus = document.querySelector("#liveStatus")
const accessForm = document.querySelector("#accessForm")
const accessCode = document.querySelector("#accessCode")
const signOut = document.querySelector("#signOut")
const permitForm = document.querySelector("#permitForm")
const addPermitForm = document.querySelector("#addPermitForm")
const toast = document.querySelector("#toast")
const permitsCard = document.querySelector("#permitsCard")
const historyCard = document.querySelector("#historyCard")
const proofSummary = document.querySelector("#proofSummary")
const proofSource = document.querySelector("#proofSource")
const documentReport = document.querySelector("#documentReport")
const documentTitle = document.querySelector("#documentTitle")
const documentSummary = document.querySelector("#documentSummary")
const documentMetadata = document.querySelector("#documentMetadata")
const documentChecklist = document.querySelector("#documentChecklist")
const documentRetention = document.querySelector("#documentRetention")

const maxFileBytes = 10 * 1024 * 1024

const tourSteps = [
  {
    title: "See what needs care.",
    text: "Your home page shows every permit and the next date that needs your care.",
    demo: "<strong>Food Service Permit</strong><small>21 days left. Civra marks this as the next task.</small>"
  },
  {
    title: "Open the permit task.",
    text: "Civra finds the right city page and makes one clear list of what the city asks for.",
    demo: "<div class='toursource'><strong>City page found</strong><span class='tourtag'>CHECKED</span></div><div class='toursource'><strong>12 facts needed</strong><span class='tourtag'>READY</span></div>"
  },
  {
    title: "Check every saved fact.",
    text: "Each answer shows where it came from. You can fix any answer before Civra uses it.",
    demo: "<div class='toursource'><div><strong>Maya's Kitchen</strong><small>Business name</small></div><span class='tourtag'>BUSINESS FILE</span></div><div class='toursource'><div><strong>128 Orchard Street</strong><small>Business address</small></div><span class='tourtag'>LEASE</span></div>"
  },
  {
    title: "Add only what is missing.",
    text: "Civra asks for one missing file at a time. You do not need to start the form again.",
    demo: "<strong>Permit document needs verification</strong><small>PDF, JPG, or PNG. Civra checks its actual signature before extracting any evidence.</small>"
  },
  {
    title: "Check the safety rules.",
    text: "Civra shows what will happen before any file leaves your control.",
    demo: "<div class='tourlock'><span>1</span><div><strong>No city upload</strong><small>Civra does not send your document to a city site.</small></div></div><div class='tourlock'><span>2</span><div><strong>Ephemeral sandbox</strong><small>Civra destroys the separate Solari work space after each check.</small></div></div><div class='tourlock'><span>3</span><div><strong>No key in the page</strong><small>The Solari key stays on the server, not in the browser.</small></div></div>"
  },
  {
    title: "You make the final choice.",
    text: "Review the full form, payment, and files. Civra waits until you choose to go on.",
    demo: "<strong>Ready for owner review</strong><small>No payment made. No form sent. You stay in charge.</small>"
  }
]

let tourStep = 0
let toastTimer
let selectedFile = null
let sessionOpen = false

function showToast(message) {
  toast.textContent = message
  toast.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600)
}

function showAndFocus(element) {
  element.scrollIntoView({ behavior: "smooth", block: "center" })
  element.focus({ preventScroll: true })
  element.classList.remove("focusflash")
  requestAnimationFrame(() => element.classList.add("focusflash"))
}

function showTourStep() {
  const step = tourSteps[tourStep]
  tourTitle.textContent = step.title
  tourText.textContent = step.text
  tourDemo.innerHTML = step.demo
  tourCount.textContent = `Step ${tourStep + 1} of ${tourSteps.length}`
  tourIcon.textContent = String(tourStep + 1)
  tourBar.className = `tourbar${tourStep + 1}`
  tourBack.disabled = tourStep === 0
  tourNext.textContent = tourStep === tourSteps.length - 1 ? "Open my permit task" : "Next step"
}

function openSheet() {
  sheet.classList.add("show")
  sheet.setAttribute("aria-hidden", "false")
}

function closeSheet() {
  sheet.classList.remove("show")
  sheet.setAttribute("aria-hidden", "true")
}

document.querySelector("#openFlow").addEventListener("click", openSheet)
document.querySelector("#closeFlow").addEventListener("click", closeSheet)
document.querySelector("#closeButton").addEventListener("click", closeSheet)
document.querySelector("#addPermit").addEventListener("click", () => {
  permitForm.classList.add("show")
  permitForm.setAttribute("aria-hidden", "false")
  document.querySelector("#newPermitName").focus()
})
document.querySelector("#closePermitForm").addEventListener("click", () => {
  permitForm.classList.remove("show")
  permitForm.setAttribute("aria-hidden", "true")
})
document.querySelector("#viewPermits").addEventListener("click", () => showAndFocus(permitsCard))
document.querySelector("#viewHistory").addEventListener("click", () => showAndFocus(historyCard))

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav").forEach(item => item.classList.remove("active"))
    button.classList.add("active")
    const page = button.dataset.page
    if (page === "home") window.scrollTo({ top: 0, behavior: "smooth" })
    if (page === "permits") showAndFocus(permitsCard)
    if (page === "files") openSheet()
    if (page === "history") showAndFocus(historyCard)
  })
})
document.querySelector("#helpButton").addEventListener("click", () => {
  tourStep = 0
  showTourStep()
  guide.classList.add("show")
  guide.setAttribute("aria-hidden", "false")
})
document.querySelector("#closeGuide").addEventListener("click", () => {
  guide.classList.remove("show")
  guide.setAttribute("aria-hidden", "true")
})
tourBack.addEventListener("click", () => {
  if (tourStep === 0) return
  tourStep -= 1
  showTourStep()
})
tourNext.addEventListener("click", () => {
  if (tourStep < tourSteps.length - 1) {
    tourStep += 1
    showTourStep()
    return
  }
  guide.classList.remove("show")
  guide.setAttribute("aria-hidden", "true")
  openSheet()
})

function updateDocumentButton() {
  continueButton.disabled = !selectedFile || !sessionOpen
}

function clearSelectedFile() {
  selectedFile = null
  fileInput.value = ""
  updateDocumentButton()
}

function appendDetail(parent, label, value) {
  const term = document.createElement("dt")
  term.textContent = label
  const description = document.createElement("dd")
  description.textContent = String(value)
  parent.append(term, description)
}

function showDocumentResult(result) {
  const documentInfo = result.document || {}
  const summary = result.summary || {}
  const source = result.source || {}
  documentReport.hidden = false
  documentTitle.textContent = (documentInfo.format || "Document") + " signature verified"
  documentSummary.textContent = (summary.ready || 0) + " ready, " + (summary.missing || 0) + " missing, and " + (summary.unknown || 0) + " unknown against requirement set " + (result.requirementVersion || "unknown") + ". “Ready” means document evidence was found; it is not permission to submit."

  documentMetadata.replaceChildren()
  appendDetail(documentMetadata, "File type", documentInfo.mediaType || "unknown")
  appendDetail(documentMetadata, "File size", String(documentInfo.bytes || 0) + " bytes")
  appendDetail(documentMetadata, "Searchable text", documentInfo.textExtracted ? "extracted" : "not safely available")
  if (documentInfo.textMethod && documentInfo.textMethod !== "none") appendDetail(documentMetadata, "Text method", documentInfo.textMethod)
  for (const [key, value] of Object.entries(documentInfo.metadata || {})) {
    if (value !== null && value !== "") appendDetail(documentMetadata, key, value)
  }
  if (source.url) appendDetail(documentMetadata, "Official source", source.url)
  if (source.checkedAt) appendDetail(documentMetadata, "Source checked", new Date(source.checkedAt).toLocaleString())

  documentChecklist.replaceChildren()
  for (const check of result.checklist || []) {
    const row = document.createElement("article")
    row.className = "documentcheck " + (check.status || "unknown")
    const heading = document.createElement("strong")
    heading.textContent = check.label || "Requirement"
    const status = document.createElement("span")
    status.textContent = String(check.status || "unknown").toUpperCase()
    const reason = document.createElement("p")
    reason.textContent = check.reason || "No explanation is available."
    row.append(heading, status, reason)
    if (check.evidence) {
      const evidence = document.createElement("blockquote")
      evidence.textContent = check.evidence
      row.append(evidence)
    }
    documentChecklist.append(row)
  }

  documentRetention.textContent = result.retention || "Civra does not retain this file after processing."
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0]
  if (!file) return

  if (file.size > maxFileBytes) {
    fileOk.textContent = "This file is too large. Use a file under 10 MB."
    clearSelectedFile()
    return
  }

  selectedFile = file
  fileOk.textContent = file.name + " is ready. Civra will verify its real file signature, not the browser file type."
  updateDocumentButton()
})

continueButton.addEventListener("click", async () => {
  if (!selectedFile || !sessionOpen) {
    fileOk.textContent = "Unlock live checks, then choose a document to verify."
    updateDocumentButton()
    return
  }

  let file = selectedFile
  selectedFile = null
  continueButton.disabled = true
  continueButton.textContent = "Verifying file in a private sandbox…"
  fileOk.textContent = "Civra is checking the actual file bytes. This can take a moment."

  try {
    const response = await fetch("/api/document-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Civra-Action": "document-check"
      },
      body: file
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Civra could not verify this file.")
    showDocumentResult(result)
    fileOk.textContent = "Document checked. Review the evidence below."
  } catch (error) {
    fileOk.textContent = error instanceof Error ? error.message : "Civra could not verify this file."
  } finally {
    // The browser selection is cleared after every attempt; the server never
    // writes the file to disk and destroys its sandbox after processing.
    file = null
    clearSelectedFile()
    continueButton.textContent = "Verify document"
  }
})

addPermitForm.addEventListener("submit", event => {
  event.preventDefault()
  const name = document.querySelector("#newPermitName").value.trim()
  const date = document.querySelector("#newPermitDate").value
  if (!name || !date) return

  const row = document.createElement("div")
  row.className = "permitrow"

  const icon = document.createElement("div")
  icon.className = "icon pale"
  icon.textContent = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()

  const details = document.createElement("div")
  details.className = "grow"
  const title = document.createElement("strong")
  title.textContent = name
  const due = document.createElement("span")
  due.textContent = `Due ${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
  details.append(title, due)

  const state = document.createElement("span")
  state.className = "pill safe"
  state.textContent = "Added"
  row.append(icon, details, state)
  document.querySelector(".permits").append(row)

  permitForm.classList.remove("show")
  permitForm.setAttribute("aria-hidden", "true")
  addPermitForm.reset()
  showAndFocus(permitsCard)
  showToast(`${name} was added to this demo.`)
})

liveCheck.addEventListener("click", async () => {
  liveCheck.disabled = true
  liveStatus.textContent = "Solari is checking the official city page."

  try {
    const response = await fetch("/api/permit-check", {
      method: "POST",
      headers: { "X-Civra-Action": "permit-check" }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "The city check failed.")

    if (!result.pageVerified) {
      liveStatus.textContent = "The city page does not look like the expected permit page. Every item is unknown until a person reviews it."
      return
    }

    const statuses = Object.values(result.checks)
    const found = statuses.filter(check => check.status === "found").length
    const missing = statuses.filter(check => check.status === "missing").length
    const note = result.fromCache ? " Shown from the last check." : ""
    liveStatus.textContent = missing === 0
      ? `Live check done. All ${found} permit needs were found on the city page.${note}`
      : `Live check done. ${found} found and ${missing} not found on the city page. Please review.${note}`
  } catch (error) {
    liveStatus.textContent = error instanceof Error ? error.message : "The city check failed."
  } finally {
    liveCheck.disabled = false
  }
})

function showSession(isOpen) {
  sessionOpen = isOpen
  liveCheck.disabled = !isOpen
  accessForm.hidden = isOpen
  signOut.hidden = !isOpen
  updateDocumentButton()
  liveStatus.textContent = isOpen
    ? "Live check is unlocked for this browser."
    : "Unlock before using the paid Solari check."
}

async function syncSession() {
  try {
    const response = await fetch("/api/session")
    const result = await response.json()
    showSession(Boolean(result.authenticated))
  } catch {
    showSession(false)
    liveStatus.textContent = "The server could not check your Civra session."
  }
}

async function loadLiveProof() {
  try {
    const response = await fetch("/live-proof.json")
    const proof = await response.json()
    if (!response.ok || !proof.pageVerified) throw new Error("Proof is not verified")
    const found = Object.values(proof.checks).filter(check => check.status === "found").length
    const date = new Date(proof.checkedAt).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })
    proofSummary.textContent = `${found} of 4 needs found on the official city page. Recorded browser run on ${date}.`
    proofSource.href = proof.source
  } catch {
    proofSummary.textContent = "The saved live proof could not be loaded. Run the check again before relying on it."
  }
}

accessForm.addEventListener("submit", async event => {
  event.preventDefault()
  const code = accessCode.value
  accessCode.value = ""
  liveStatus.textContent = "Checking the Civra access code."

  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode: code })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "The access code was not accepted.")
    showSession(true)
  } catch (error) {
    showSession(false)
    liveStatus.textContent = error instanceof Error ? error.message : "The access code was not accepted."
  }
})

signOut.addEventListener("click", async () => {
  await fetch("/api/session", { method: "DELETE" }).catch(() => undefined)
  showSession(false)
})

syncSession()
loadLiveProof()
