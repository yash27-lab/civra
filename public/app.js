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
const renewalsCard = document.querySelector("#renewalsCard")
const renewalSummary = document.querySelector("#renewalSummary")
const renewalQueue = document.querySelector("#renewalQueue")
const downloadRenewals = document.querySelector("#downloadRenewals")
const clearRenewals = document.querySelector("#clearRenewals")
const downloadRenewalBackup = document.querySelector("#downloadRenewalBackup")
const restoreRenewalBackupButton = document.querySelector("#restoreRenewalBackupButton")
const renewalBackupInput = document.querySelector("#renewalBackupInput")
const renewalBackupStatus = document.querySelector("#renewalBackupStatus")
const historyCard = document.querySelector("#historyCard")
const proofSummary = document.querySelector("#proofSummary")
const proofSource = document.querySelector("#proofSource")
const todayLabel = document.querySelector("#todayLabel")
const greetingHeading = document.querySelector("#greetingHeading")
const nextRenewalDays = document.querySelector("#nextRenewalDays")
const nextRenewalUnit = document.querySelector("#nextRenewalUnit")
const nextRenewalTitle = document.querySelector("#nextRenewalTitle")
const nextRenewalDescription = document.querySelector("#nextRenewalDescription")
const sourceHistoryCard = document.querySelector("#sourceHistoryCard")
const sourceHistoryStatus = document.querySelector("#sourceHistoryStatus")
const sourceHistoryList = document.querySelector("#sourceHistoryList")
const sourceEvidence = document.querySelector("#sourceEvidence")
const sourceEvidenceTitle = document.querySelector("#sourceEvidenceTitle")
const sourceEvidenceMeta = document.querySelector("#sourceEvidenceMeta")
const sourceFingerprintValue = document.querySelector("#sourceFingerprintValue")
const sourceEvidenceChecks = document.querySelector("#sourceEvidenceChecks")
const sourceEvidenceLink = document.querySelector("#sourceEvidenceLink")
const closeSourceEvidence = document.querySelector("#closeSourceEvidence")
const compareSourceEvidence = document.querySelector("#compareSourceEvidence")
const copySourceFingerprint = document.querySelector("#copySourceFingerprint")
const downloadSourceReview = document.querySelector("#downloadSourceReview")
const sourceComparison = document.querySelector("#sourceComparison")
const sourceComparisonTitle = document.querySelector("#sourceComparisonTitle")
const sourceComparisonMeta = document.querySelector("#sourceComparisonMeta")
const sourceComparisonList = document.querySelector("#sourceComparisonList")
const documentReport = document.querySelector("#documentReport")
const documentTitle = document.querySelector("#documentTitle")
const documentSummary = document.querySelector("#documentSummary")
const documentMetadata = document.querySelector("#documentMetadata")
const documentChecklist = document.querySelector("#documentChecklist")
const documentRetention = document.querySelector("#documentRetention")
const pageMain = document.querySelector("main")
const sideNav = document.querySelector(".side")

const maxFileBytes = 10 * 1024 * 1024
const maxTrackedRenewals = 50
const maxRenewalBackupBytes = 128 * 1024

const tourSteps = [
  {
    title: "See what needs care.",
    text: "Your home page shows every permit and the next date that needs your care.",
    demo: "<strong>Food Service Permit</strong><small>Review its saved due date and source evidence.</small>"
  },
  {
    title: "Open the permit task.",
    text: "Civra checks its supported NYC city page and records requirement evidence for you to review.",
    demo: "<div class='toursource'><strong>Official city page</strong><span class='tourtag'>CHECKED</span></div><div class='toursource'><strong>Requirement evidence</strong><span class='tourtag'>REVIEW</span></div>"
  },
  {
    title: "Review recorded evidence.",
    text: "Each result includes its status and any saved official-page excerpt. Unknown means you should review the source yourself.",
    demo: "<div class='toursource'><div><strong>Requirement result</strong><small>Read its status and evidence excerpt</small></div><span class='tourtag'>REVIEW</span></div><div class='toursource'><div><strong>Source snapshot</strong><small>Check when it was recorded</small></div><span class='tourtag'>HISTORY</span></div>"
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
    text: "Confirm open questions with the city, then decide what to do next. Civra does not submit a form or pay a fee.",
    demo: "<strong>Ready for owner review</strong><small>No payment made. No form sent. You stay in charge.</small>"
  }
]

let tourStep = 0
let toastTimer
let selectedFile = null
let editingRenewal = null
let sessionOpen = false
let sheetReturnFocus = null
let guideReturnFocus = null
let permitFormReturnFocus = null
let selectedSourceSnapshotId = null
let selectedSourceSnapshot = null
let selectedSourceComparison = null
let sourceEvidenceRequest = 0
let sourceComparisonRequest = 0
const renewalStorageKey = "civra_renewals_v1"
const defaultRenewals = [
  { name: "Food Service Permit", dueDate: "2026-09-21" },
  { name: "Food Handler Card", dueDate: "2027-06-14" }
]

function renderTodayHeader() {
  const now = new Date()
  todayLabel.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).toUpperCase()
  const greeting = now.getHours() < 12
    ? "Good morning"
    : now.getHours() < 17
      ? "Good afternoon"
      : "Good evening"
  greetingHeading.textContent = greeting + ", Maya."
}

function scheduleDailyRefresh() {
  const now = new Date()
  const nextLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  window.setTimeout(() => {
    renderTodayHeader()
    renderRenewals()
    scheduleDailyRefresh()
  }, nextLocalMidnight.getTime() - now.getTime())
}

function localDate(value) {
  const [year, month, day] = String(value).split("-").map(Number)
  return new Date(year, month - 1, day)
}

function validRenewal(value) {
  const name = String(value && value.name || "").replace(/\s+/g, " ").trim()
  const dueDate = String(value && value.dueDate || "")
  const date = localDate(dueDate)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !Number.isNaN(date.valueOf()) &&
    date.getFullYear() === Number(dueDate.slice(0, 4)) &&
    date.getMonth() + 1 === Number(dueDate.slice(5, 7)) &&
    date.getDate() === Number(dueDate.slice(8, 10))
  return name && name.length <= 80 && validDate ? { name, dueDate } : null
}

function loadRenewals() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(renewalStorageKey) || "null")
    if (!Array.isArray(saved)) return defaultRenewals.map(renewal => ({ ...renewal }))
    return saved.map(validRenewal).filter(Boolean).slice(0, maxTrackedRenewals)
  } catch {
    return defaultRenewals.map(renewal => ({ ...renewal }))
  }
}

function saveRenewals(renewals = trackedRenewals) {
  try {
    window.localStorage.setItem(renewalStorageKey, JSON.stringify(renewals))
    return true
  } catch {
    return false
  }
}

let trackedRenewals = loadRenewals()

function buildRenewalBackup(renewals = trackedRenewals, exportedAt = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    exportedAt,
    reminders: renewals.map(({ name, dueDate }) => ({ name, dueDate }))
  }
}

function parseRenewalBackup(text) {
  let backup
  try {
    backup = JSON.parse(text)
  } catch {
    throw new Error("This file is not valid JSON.")
  }

  if (!backup || backup.schemaVersion !== 1 || !Array.isArray(backup.reminders)) {
    throw new Error("This file is not a supported Civra renewal backup.")
  }
  if (backup.reminders.length > maxTrackedRenewals) {
    throw new Error("A backup can contain no more than " + maxTrackedRenewals + " reminders.")
  }

  const renewals = backup.reminders.map(validRenewal)
  if (renewals.some(renewal => !renewal)) {
    throw new Error("Every reminder needs a name up to 80 characters and a valid due date.")
  }

  const seen = new Set()
  for (const renewal of renewals) {
    const key = renewal.name.toLowerCase() + "\n" + renewal.dueDate
    if (seen.has(key)) throw new Error("This backup contains duplicate reminders.")
    seen.add(key)
  }
  return renewals
}

function formatIcsDate(date) {
  const pad = value => String(value).padStart(2, "0")
  return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate())
}

function localDateKey(date = new Date()) {
  const pad = value => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function icsEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

function foldIcsLine(value) {
  const encoder = new TextEncoder()
  let folded = ""
  let lineBytes = 0

  for (const character of String(value)) {
    const characterBytes = encoder.encode(character).length
    if (lineBytes + characterBytes > 75) {
      folded += "\r\n "
      lineBytes = 1
    }
    folded += character
    lineBytes += characterBytes
  }

  return folded
}

function buildRenewalCalendar(renewals) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Civra//Owner Renewal Review//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ]

  const nameOccurrences = new Map()
  const stableOrder = [...renewals].sort((left, right) => {
    const leftName = left.name.trim().toLowerCase()
    const rightName = right.name.trim().toLowerCase()
    if (leftName !== rightName) return leftName < rightName ? -1 : 1
    if (left.dueDate !== right.dueDate) return left.dueDate < right.dueDate ? -1 : 1
    return 0
  })
  const calendarEntries = stableOrder.map(renewal => {
    const key = renewal.name.trim().toLowerCase()
    const occurrence = nameOccurrences.get(key) || 0
    nameOccurrences.set(key, occurrence + 1)
    return {
      renewal,
      uid: "civra-" + encodeURIComponent(key) + "-" + occurrence + "@local"
    }
  })

  calendarEntries
    .sort((left, right) => left.renewal.dueDate.localeCompare(right.renewal.dueDate))
    .forEach(({ renewal, uid }) => {
      const reviewDate = localDate(renewal.dueDate)
      reviewDate.setDate(reviewDate.getDate() - 30)
      if (reviewDate < now) reviewDate.setTime(now.getTime())
      const endDate = new Date(reviewDate)
      endDate.setDate(endDate.getDate() + 1)
      lines.push(
        "BEGIN:VEVENT",
        "UID:" + uid,
        "DTSTAMP:" + timestamp,
        "DTSTART;VALUE=DATE:" + formatIcsDate(reviewDate),
        "DTEND;VALUE=DATE:" + formatIcsDate(endDate),
        "TRANSP:TRANSPARENT",
        "SUMMARY:" + icsEscape("Review renewal: " + renewal.name),
        "DESCRIPTION:" + icsEscape("Created locally by Civra for owner review only. Civra will not submit, pay, or notify anyone."),
        "END:VEVENT"
      )
    })

  lines.push("END:VCALENDAR")
  return lines.map(foldIcsLine).join("\r\n") + "\r\n"
}

function downloadRenewalBackupFile() {
  try {
    const backup = buildRenewalBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2) + "\n"], {
      type: "application/json;charset=utf-8"
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "civra-renewals-" + localDateKey() + ".json"
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    showToast(backup.reminders.length + " reminder" + (backup.reminders.length === 1 ? "" : "s") + " exported to a local backup.")
  } catch {
    showToast("Civra could not create the reminder backup in this browser.")
  }
}

async function restoreRenewalBackupFile(file) {
  if (!file) return
  restoreRenewalBackupButton.disabled = true
  renewalBackupStatus.textContent = "Checking the selected backup file."
  try {
    if (file.size > maxRenewalBackupBytes) {
      throw new Error("Choose a backup that is 128 KB or smaller.")
    }
    const renewals = parseRenewalBackup(await file.text())
    if (trackedRenewals.length > 0 && !window.confirm("Replace the " + trackedRenewals.length + " current reminders with " + renewals.length + " reminders from this backup?")) {
      renewalBackupStatus.textContent = "Restore canceled. Current reminders were kept."
      showToast("Backup restore was canceled; your current reminders were kept.")
      return
    }
    if (!saveRenewals(renewals)) {
      throw new Error("Civra could not save the backup in this browser. Existing reminders were kept.")
    }
    trackedRenewals = renewals
    renderRenewals()
    renewalBackupStatus.textContent = renewals.length + " reminder" + (renewals.length === 1 ? "" : "s") + " restored."
    showToast(renewals.length + " reminder" + (renewals.length === 1 ? "" : "s") + " restored from backup.")
  } catch (error) {
    renewalBackupStatus.textContent = error instanceof Error ? error.message : "Civra could not restore this backup."
    showToast(renewalBackupStatus.textContent)
  } finally {
    renewalBackupInput.value = ""
    restoreRenewalBackupButton.disabled = false
  }
}

function downloadRenewalCalendar() {
  if (trackedRenewals.length === 0) {
    showToast("Add a renewal reminder before downloading a calendar.")
    return
  }
  try {
    const calendar = buildRenewalCalendar(trackedRenewals)
    const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "civra-renewal-review.ics"
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    showToast("Renewal review calendar downloaded. Import it only into a calendar you control.")
  } catch {
    showToast("Civra could not create the renewal calendar file in this browser.")
  }
}

function daysUntil(value) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((localDate(value) - today) / 86400000)
}

function renewalState(days) {
  if (days < 0) {
    const lateDays = Math.abs(days)
    return { key: "overdue", label: "Overdue", detail: `${lateDays} ${lateDays === 1 ? "day" : "days"} late` }
  }
  if (days === 0) return { key: "now", label: "Review now", detail: "Due today" }
  const timing = `${days} ${days === 1 ? "day" : "days"} left`
  if (days <= 30) return { key: "now", label: "Review now", detail: timing }
  if (days <= 90) return { key: "soon", label: "Plan review", detail: timing }
  return { key: "planned", label: "Planned", detail: timing }
}

function renderNextRenewal() {
  const next = trackedRenewals
    .map(renewal => ({ ...renewal, days: daysUntil(renewal.dueDate) }))
    .sort((left, right) => left.days - right.days)[0]

  if (!next) {
    nextRenewalDays.textContent = "—"
    nextRenewalUnit.textContent = "tracked"
    nextRenewalTitle.textContent = "No renewal dates are tracked."
    nextRenewalDescription.textContent = "Add a permit and due date to see the next owner review."
    return
  }

  const due = localDate(next.dueDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
  nextRenewalDescription.textContent = next.name + " · Due " + due + ". This date is a reminder for owner review."
  if (next.days < 0) {
    const lateDays = Math.abs(next.days)
    nextRenewalDays.textContent = String(lateDays)
    nextRenewalUnit.textContent = lateDays === 1 ? "day overdue" : "days overdue"
    nextRenewalTitle.textContent = "A tracked renewal date has passed."
  } else if (next.days === 0) {
    nextRenewalDays.textContent = "0"
    nextRenewalUnit.textContent = "due today"
    nextRenewalTitle.textContent = "A tracked renewal date is due today."
  } else {
    nextRenewalDays.textContent = String(next.days)
    nextRenewalUnit.textContent = next.days === 1 ? "day left" : "days left"
    nextRenewalTitle.textContent = next.days <= 30
      ? "A tracked renewal needs owner review soon."
      : "Your next tracked renewal is coming up."
  }
}

function createTrackedPermitRow(renewal) {
  const row = document.createElement("div")
  row.className = "permitrow"
  row.dataset.renewalName = renewal.name
  row.dataset.renewalDate = renewal.dueDate

  const icon = document.createElement("div")
  icon.className = "icon pale"
  icon.textContent = renewal.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()

  const details = document.createElement("div")
  details.className = "grow"
  const title = document.createElement("strong")
  title.textContent = renewal.name
  const due = document.createElement("span")
  due.textContent = "Due " + localDate(renewal.dueDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
  details.append(title, due)

  const status = document.createElement("span")
  status.className = "pill safe"
  status.textContent = "Tracked"
  row.append(icon, details, status)
  return row
}

function renderTrackedPermitRows() {
  permitsCard.querySelectorAll(".permitrow[data-renewal-name]").forEach(row => row.remove())
  for (const renewal of trackedRenewals) {
    const isExample = defaultRenewals.some(example =>
      example.name === renewal.name && example.dueDate === renewal.dueDate
    )
    if (!isExample) permitsCard.append(createTrackedPermitRow(renewal))
  }
}

function renderRenewals() {
  renderNextRenewal()
  renderTrackedPermitRows()
  const ordered = trackedRenewals
    .map((renewal, originalIndex) => ({ ...renewal, originalIndex, days: daysUntil(renewal.dueDate) }))
    .sort((left, right) => left.days - right.days)

  renewalQueue.replaceChildren()
  if (ordered.length === 0) {
    renewalSummary.textContent = "No renewal reminders yet. Add a permit to start tracking due dates."
    const empty = document.createElement("p")
    empty.className = "renewal-empty"
    empty.textContent = "Your reminders are saved in this browser when you add them."
    renewalQueue.append(empty)
    downloadRenewals.disabled = true
    return
  }

  downloadRenewals.disabled = false
  const overdueCount = ordered.filter(renewal => renewal.days < 0).length
  const dueSoonCount = ordered.filter(renewal => renewal.days >= 0 && renewal.days <= 30).length
  if (overdueCount && dueSoonCount) {
    renewalSummary.textContent = `${overdueCount} renewal${overdueCount === 1 ? " is" : "s are"} overdue; ${dueSoonCount} more ${dueSoonCount === 1 ? "is" : "are"} due within 30 days.`
  } else if (overdueCount) {
    renewalSummary.textContent = `${overdueCount} renewal${overdueCount === 1 ? " is" : "s are"} overdue.`
  } else if (dueSoonCount) {
    renewalSummary.textContent = `${dueSoonCount} renewal${dueSoonCount === 1 ? " needs" : "s need"} owner review in the next 30 days.`
  } else {
    renewalSummary.textContent = "No upcoming tracked renewal is due within 30 days."
  }

  for (const renewal of ordered) {
    const state = renewalState(renewal.days)
    const row = document.createElement("article")
    row.className = `renewalrow ${state.key}`

    const details = document.createElement("div")
    details.className = "grow"
    const name = document.createElement("strong")
    name.textContent = renewal.name
    const due = document.createElement("small")
    due.textContent = `Due ${localDate(renewal.dueDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
    details.append(name, due)

    const status = document.createElement("span")
    status.className = `pill renewalpill ${state.key}`
    status.textContent = state.label
    const timing = document.createElement("small")
    timing.className = "renewaltiming"
    timing.textContent = state.detail

    const edit = document.createElement("button")
    edit.type = "button"
    edit.className = "renewal-edit"
    edit.dataset.index = String(renewal.originalIndex)
    edit.setAttribute("aria-label", "Edit " + renewal.name + " reminder")
    edit.textContent = "Edit"

    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "renewal-remove"
    remove.dataset.index = String(renewal.originalIndex)
    remove.setAttribute("aria-label", "Remove " + renewal.name + " reminder")
    remove.textContent = "Remove"

    row.append(details, timing, status, edit, remove)
    renewalQueue.append(row)
  }
}

function renderSourceHistory(snapshots) {
  sourceHistoryList.replaceChildren()
  if (snapshots.length === 0) {
    sourceHistoryStatus.textContent = "No source snapshots have been recorded yet."
    return
  }

  sourceHistoryStatus.textContent = `${snapshots.length} recorded source snapshot${snapshots.length === 1 ? "" : "s"} available for review.`
  for (const snapshot of snapshots) {
    const row = document.createElement("article")
    row.className = "sourcehistoryrow"

    const details = document.createElement("div")
    details.className = "grow"
    const title = document.createElement("strong")
    title.textContent = snapshot.title || snapshot.source || "Official source"
    const observed = document.createElement("small")
    observed.textContent = `Last observed ${new Date(snapshot.lastObservedAt).toLocaleString()}`
    details.append(title, observed)

    const fingerprint = document.createElement("small")
    fingerprint.className = "sourcefingerprint"
    fingerprint.textContent = `Snapshot ${String(snapshot.snapshotId).slice(0, 12)}`

    const status = document.createElement("span")
    status.className = `pill sourcehistorystate ${snapshot.pageVerified ? "verified" : "review"}`
    status.textContent = snapshot.pageVerified ? "Verified" : "Review"

    const review = document.createElement("button")
    review.type = "button"
    review.className = "sourcehistorybutton"
    review.dataset.snapshotId = snapshot.snapshotId
    review.textContent = "Review evidence"

    row.append(details, fingerprint, status, review)
    sourceHistoryList.append(row)
  }
}

function hideSourceComparison() {
  sourceComparisonRequest += 1
  sourceComparison.hidden = true
  sourceComparisonList.replaceChildren()
}

function hideSourceEvidence() {
  sourceEvidenceRequest += 1
  selectedSourceSnapshotId = null
  selectedSourceSnapshot = null
  selectedSourceComparison = null
  sourceEvidence.hidden = true
  sourceFingerprintValue.textContent = ""
  sourceEvidenceChecks.replaceChildren()
  sourceEvidenceLink.hidden = true
  sourceEvidenceLink.removeAttribute("href")
  compareSourceEvidence.hidden = true
  copySourceFingerprint.hidden = true
  delete copySourceFingerprint.dataset.fingerprint
  downloadSourceReview.hidden = true
  hideSourceComparison()
}

function renderSourceEvidence(snapshot) {
  selectedSourceSnapshotId = snapshot.snapshotId || null
  selectedSourceSnapshot = snapshot
  sourceEvidence.hidden = false
  sourceEvidenceTitle.textContent = snapshot.title || snapshot.source || "Recorded source evidence"
  const observedAt = snapshot.lastObservedAt ? new Date(snapshot.lastObservedAt).toLocaleString() : "an unknown time"
  const state = snapshot.pageVerified ? "passed Civra's source checks" : "needs owner review"
  sourceEvidenceMeta.textContent = `Recorded ${observedAt}. This snapshot ${state}.`
  const fingerprint = String(snapshot.sourceFingerprint || snapshot.snapshotId || "")
  const hasFingerprint = /^[a-f0-9]{64}$/i.test(fingerprint)
  sourceFingerprintValue.textContent = hasFingerprint ? fingerprint : "No SHA-256 fingerprint is available for this snapshot."
  if (hasFingerprint) copySourceFingerprint.dataset.fingerprint = fingerprint
  copySourceFingerprint.hidden = !hasFingerprint

  sourceEvidenceChecks.replaceChildren()
  const checks = Object.entries(snapshot.checks || {})
  if (checks.length === 0) {
    const empty = document.createElement("p")
    empty.textContent = "No requirement evidence was recorded for this snapshot."
    sourceEvidenceChecks.append(empty)
  }
  for (const [key, check] of checks) {
    const row = document.createElement("article")
    row.className = "sourceevidencecheck " + (check.status || "unknown")
    const title = document.createElement("strong")
    title.textContent = check.label || key
    const status = document.createElement("span")
    status.textContent = String(check.status || "unknown").toUpperCase()
    const reason = document.createElement("p")
    reason.textContent = check.reason || "No review note was recorded."
    row.append(title, status, reason)
    if (check.evidence) {
      const excerpt = document.createElement("blockquote")
      excerpt.textContent = check.evidence
      row.append(excerpt)
    }
    sourceEvidenceChecks.append(row)
  }

  compareSourceEvidence.hidden = !snapshot.previousSnapshotId
  downloadSourceReview.hidden = false
  hideSourceComparison()

  const sourceUrl = snapshot.finalUrl || snapshot.source
  if (sourceUrl) {
    sourceEvidenceLink.href = sourceUrl
    sourceEvidenceLink.hidden = false
  } else {
    sourceEvidenceLink.hidden = true
    sourceEvidenceLink.removeAttribute("href")
  }
}

async function loadSourceEvidence(snapshotId) {
  hideSourceEvidence()
  const requestId = ++sourceEvidenceRequest
  sourceEvidence.hidden = false
  sourceEvidenceTitle.textContent = "Loading recorded source evidence"
  sourceEvidenceMeta.textContent = "Civra is loading the saved official-page evidence."
  try {
    const response = await fetch("/api/source-history/" + encodeURIComponent(snapshotId))
    const result = await response.json()
    if (requestId !== sourceEvidenceRequest) return
    if (!response.ok) throw new Error(result.message || "Civra could not load this source evidence.")
    renderSourceEvidence(result.snapshot || {})
  } catch (error) {
    if (requestId !== sourceEvidenceRequest) return
    sourceEvidenceTitle.textContent = "Recorded source evidence unavailable"
    sourceEvidenceMeta.textContent = error instanceof Error ? error.message : "Civra could not load this source evidence."
  }
}

function renderSourceComparison(comparison) {
  selectedSourceComparison = comparison
  sourceComparison.hidden = false
  const previous = comparison.previous
  const current = comparison.current
  if (!previous) {
    sourceComparisonTitle.textContent = "No prior snapshot is available"
    sourceComparisonMeta.textContent = "Civra cannot compare this snapshot because it has no recorded predecessor."
    sourceComparisonList.replaceChildren()
    return
  }

  sourceComparisonTitle.textContent = "Changes from the prior recorded snapshot"
  const changes = Array.isArray(comparison.changes) ? comparison.changes : []
  const unchanged = Number.isInteger(comparison.unchangedCount) ? comparison.unchangedCount : 0
  sourceComparisonMeta.textContent = `${changes.length} requirement change${changes.length === 1 ? "" : "s"} and ${unchanged} unchanged. This is a comparison of recorded official-page evidence, not an approval decision.`
  sourceComparisonList.replaceChildren()
  if (changes.length === 0) {
    const none = document.createElement("p")
    none.textContent = "No requirement-level changes were recorded."
    sourceComparisonList.append(none)
    return
  }

  for (const change of changes) {
    const row = document.createElement("article")
    row.className = "sourcecomparisonrow " + (change.kind || "changed")
    const heading = document.createElement("strong")
    heading.textContent = change.label || change.key || "Requirement"
    const kind = document.createElement("span")
    kind.textContent = String(change.kind || "changed").toUpperCase()
    const before = document.createElement("p")
    before.textContent = "Before: " + (change.before?.status || "not recorded") + (change.before?.evidence ? " — " + change.before.evidence : "")
    const after = document.createElement("p")
    after.textContent = "Now: " + (change.after?.status || "not recorded") + (change.after?.evidence ? " — " + change.after.evidence : "")
    row.append(heading, kind, before, after)
    sourceComparisonList.append(row)
  }
}

function buildSourceReviewPacket(snapshot, comparison, exportedAt = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    exportedAt,
    purpose: "Owner review only",
    warning: "This packet records source evidence and differences. It is not a permit, approval, filing, payment, or notification.",
    sourceSnapshot: snapshot || null,
    sourceComparison: comparison || null
  }
}

function downloadSourceReviewPacket() {
  if (!selectedSourceSnapshot) return
  try {
    const packet = buildSourceReviewPacket(selectedSourceSnapshot, selectedSourceComparison)
    const blob = new Blob([JSON.stringify(packet, null, 2) + "\n"], { type: "application/json;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "civra-source-review-" + String(selectedSourceSnapshot.snapshotId || "packet").slice(0, 12) + ".json"
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    showToast("Source review packet downloaded locally.")
  } catch {
    showToast("Civra could not create the local review packet in this browser.")
  }
}

async function loadSourceComparison() {
  if (!selectedSourceSnapshotId) return
  const requestId = ++sourceComparisonRequest
  sourceComparison.hidden = false
  sourceComparisonTitle.textContent = "Comparing recorded snapshots"
  sourceComparisonMeta.textContent = "Civra is comparing the recorded official-page evidence."
  sourceComparisonList.replaceChildren()
  try {
    const response = await fetch("/api/source-history/" + encodeURIComponent(selectedSourceSnapshotId) + "/compare")
    const result = await response.json()
    if (requestId !== sourceComparisonRequest) return
    if (!response.ok) throw new Error(result.message || "Civra could not compare these source snapshots.")
    renderSourceComparison(result.comparison || {})
  } catch (error) {
    if (requestId !== sourceComparisonRequest) return
    sourceComparisonTitle.textContent = "Source comparison unavailable"
    sourceComparisonMeta.textContent = error instanceof Error ? error.message : "Civra could not compare these source snapshots."
  }
}

async function loadSourceHistory() {
  if (!sessionOpen) {
    sourceHistoryStatus.textContent = "Unlock Civra to review recorded source history."
    sourceHistoryList.replaceChildren()
    hideSourceEvidence()
    return
  }

  sourceHistoryStatus.textContent = "Loading recorded source history."
  try {
    const response = await fetch("/api/source-history")
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Civra could not load source history.")
    renderSourceHistory(Array.isArray(result.snapshots) ? result.snapshots : [])
  } catch (error) {
    sourceHistoryList.replaceChildren()
    sourceHistoryStatus.textContent = error instanceof Error ? error.message : "Civra could not load source history."
  }
}

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

function setDialogTriggerExpanded(trigger, dialogId, expanded) {
  if (trigger && trigger.getAttribute("aria-controls") === dialogId) {
    trigger.setAttribute("aria-expanded", String(expanded))
  }
}

function setBackgroundInert(inert) {
  pageMain.inert = inert
  sideNav.inert = inert
}

function activeDialog() {
  if (permitForm.classList.contains("show")) return addPermitForm
  if (guide.classList.contains("show")) return guide.querySelector('[role="dialog"]')
  if (sheet.classList.contains("show")) return sheet.querySelector('[role="dialog"]')
  return null
}

function keepTabFocusInDialog(event) {
  const dialog = activeDialog()
  if (!dialog) return

  const focusable = [...dialog.querySelectorAll(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  )].filter(element => !element.closest("[hidden]") && element.getAttribute("aria-hidden") !== "true")

  if (focusable.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const focusOutsideDialog = !dialog.contains(document.activeElement)
  if (event.shiftKey && (focusOutsideDialog || document.activeElement === first)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (focusOutsideDialog || document.activeElement === last)) {
    event.preventDefault()
    first.focus()
  }
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

function openSheet(returnFocus = document.activeElement) {
  sheetReturnFocus = returnFocus
  setDialogTriggerExpanded(returnFocus, "sheet", true)
  setBackgroundInert(true)
  sheet.classList.add("show")
  sheet.setAttribute("aria-hidden", "false")
  document.querySelector("#closeButton").focus()
}

function closeSheet() {
  sheet.classList.remove("show")
  sheet.setAttribute("aria-hidden", "true")
  setBackgroundInert(false)
  setDialogTriggerExpanded(sheetReturnFocus, "sheet", false)
  if (sheetReturnFocus && sheetReturnFocus.isConnected) sheetReturnFocus.focus()
  sheetReturnFocus = null
}

document.querySelector("#openFlow").addEventListener("click", openSheet)
document.querySelector("#closeFlow").addEventListener("click", closeSheet)
document.querySelector("#closeButton").addEventListener("click", closeSheet)
function openRenewalForm(renewal = null, returnFocus = document.activeElement) {
  editingRenewal = renewal ? { ...renewal } : null
  permitFormReturnFocus = returnFocus
  addPermitForm.reset()
  document.querySelector("#permitFormTitle").textContent = renewal ? "Edit renewal reminder" : "What should Civra track?"
  document.querySelector("#permitFormSubmit").textContent = renewal ? "Save changes" : "Save permit"
  if (renewal) {
    document.querySelector("#newPermitName").value = renewal.name
    document.querySelector("#newPermitDate").value = renewal.dueDate
  }
  permitForm.classList.add("show")
  setDialogTriggerExpanded(returnFocus, "permitForm", true)
  setBackgroundInert(true)
  permitForm.setAttribute("aria-hidden", "false")
  document.querySelector("#newPermitName").focus()
}

function closeRenewalForm() {
  editingRenewal = null
  addPermitForm.reset()
  document.querySelector("#permitFormTitle").textContent = "What should Civra track?"
  document.querySelector("#permitFormSubmit").textContent = "Save permit"
  permitForm.classList.remove("show")
  permitForm.setAttribute("aria-hidden", "true")
  setBackgroundInert(false)
  const returnFocus = permitFormReturnFocus
  permitFormReturnFocus = null
  setDialogTriggerExpanded(returnFocus, "permitForm", false)
  if (returnFocus && returnFocus.isConnected) returnFocus.focus()
  else document.querySelector("#addPermit").focus()
}

document.querySelector("#addPermit").addEventListener("click", event => openRenewalForm(null, event.currentTarget))
document.querySelector("#closePermitForm").addEventListener("click", closeRenewalForm)
document.querySelector("#viewPermits").addEventListener("click", () => showAndFocus(permitsCard))
document.querySelector("#viewHistory").addEventListener("click", () => showAndFocus(historyCard))
sourceHistoryList.addEventListener("click", event => {
  const button = event.target.closest(".sourcehistorybutton")
  if (button && button.dataset.snapshotId) loadSourceEvidence(button.dataset.snapshotId)
})
closeSourceEvidence.addEventListener("click", hideSourceEvidence)
compareSourceEvidence.addEventListener("click", loadSourceComparison)
copySourceFingerprint.addEventListener("click", async () => {
  const fingerprint = copySourceFingerprint.dataset.fingerprint
  if (!fingerprint) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.")
    await navigator.clipboard.writeText(fingerprint)
    showToast("Full SHA-256 fingerprint copied.")
  } catch {
    showToast("Select the fingerprint above to copy it manually.")
  }
})
downloadSourceReview.addEventListener("click", downloadSourceReviewPacket)
downloadRenewals.addEventListener("click", downloadRenewalCalendar)
downloadRenewalBackup.addEventListener("click", downloadRenewalBackupFile)
restoreRenewalBackupButton.addEventListener("click", () => renewalBackupInput.click())
renewalBackupInput.addEventListener("change", () => restoreRenewalBackupFile(renewalBackupInput.files[0]))
renewalQueue.addEventListener("click", event => {
  const editButton = event.target.closest(".renewal-edit")
  if (editButton) {
    const index = Number(editButton.dataset.index)
    if (Number.isInteger(index) && index >= 0 && index < trackedRenewals.length) {
      openRenewalForm(trackedRenewals[index], editButton)
    }
    return
  }

  const button = event.target.closest(".renewal-remove")
  if (!button) return
  const index = Number(button.dataset.index)
  if (!Number.isInteger(index) || index < 0 || index >= trackedRenewals.length) return

  const [removed] = trackedRenewals.splice(index, 1)
  const saved = saveRenewals()
  renderRenewals()
  showToast(saved
    ? removed.name + " was removed from this browser."
    : removed.name + " was removed for this page, but the browser could not save the change."
  )
})
clearRenewals.addEventListener("click", () => {
  const customRenewals = trackedRenewals.filter(renewal => !defaultRenewals.some(example =>
    example.name === renewal.name && example.dueDate === renewal.dueDate
  ))
  if (customRenewals.length > 0 && !window.confirm(`Reset demo dates and remove ${customRenewals.length} custom reminder${customRenewals.length === 1 ? "" : "s"}?`)) {
    renewalBackupStatus.textContent = "Reset canceled. Your reminders were kept."
    return
  }
  try {
    window.localStorage.removeItem(renewalStorageKey)
  } catch {
    renewalBackupStatus.textContent = "Civra could not reset the saved reminders. Your current reminders were kept."
    showToast("Civra could not reset reminders. Your current list was kept.")
    return
  }
  trackedRenewals = defaultRenewals.map(renewal => ({ ...renewal }))
  renderRenewals()
  renewalBackupStatus.textContent = "Demo reminder dates were restored in this browser."
  showToast("Demo renewal dates were restored in this browser.")
})

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav").forEach(item => {
      item.classList.remove("active")
      item.removeAttribute("aria-current")
    })
    button.classList.add("active")
    button.setAttribute("aria-current", "location")
    const page = button.dataset.page
    if (page === "home") window.scrollTo({ top: 0, behavior: "smooth" })
    if (page === "permits") showAndFocus(permitsCard)
    if (page === "renewals") showAndFocus(renewalsCard)
    if (page === "files") openSheet()
    if (page === "history") showAndFocus(historyCard)
  })
})
function closeGuide({ releaseBackground = true } = {}) {
  guide.classList.remove("show")
  guide.setAttribute("aria-hidden", "true")
  if (releaseBackground) setBackgroundInert(false)
  const returnFocus = guideReturnFocus
  guideReturnFocus = null
  setDialogTriggerExpanded(returnFocus, "guide", false)
  if (returnFocus && returnFocus.isConnected) returnFocus.focus()
}

document.querySelector("#helpButton").addEventListener("click", event => {
  guideReturnFocus = event.currentTarget
  setDialogTriggerExpanded(guideReturnFocus, "guide", true)
  setBackgroundInert(true)
  tourStep = 0
  showTourStep()
  guide.classList.add("show")
  guide.setAttribute("aria-hidden", "false")
  document.querySelector("#closeGuide").focus()
})
document.querySelector("#closeGuide").addEventListener("click", closeGuide)
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
  closeGuide({ releaseBackground: false })
  openSheet(document.querySelector("#helpButton"))
})

function updateDocumentButton() {
  continueButton.disabled = !selectedFile || !sessionOpen
}

function clearSelectedFile() {
  selectedFile = null
  fileInput.value = ""
  updateDocumentButton()
}

function clearDocumentReport() {
  documentReport.hidden = true
  documentTitle.textContent = "Document checked"
  documentSummary.textContent = ""
  documentMetadata.replaceChildren()
  documentChecklist.replaceChildren()
  documentRetention.textContent = ""
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
    const remaining = Number.isInteger(result.remainingDocumentChecks)
      ? ` ${result.remainingDocumentChecks} document check${result.remainingDocumentChecks === 1 ? "" : "s"} ${result.remainingDocumentChecks === 1 ? "remains" : "remain"} in this session.`
      : ""
    fileOk.textContent = "Document checked. Review the evidence below." + remaining
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
  const name = document.querySelector("#newPermitName").value.replace(/\s+/g, " ").trim()
  const date = document.querySelector("#newPermitDate").value
  if (!name) {
    showToast("Enter a permit name before saving.")
    document.querySelector("#newPermitName").focus()
    return
  }
  if (!date) return

  const editingIndex = editingRenewal
    ? trackedRenewals.findIndex(renewal => renewal.name === editingRenewal.name && renewal.dueDate === editingRenewal.dueDate)
    : -1
  if (editingRenewal && editingIndex < 0) {
    showToast("That reminder changed in another tab. Reopen it before editing.")
    closeRenewalForm()
    return
  }

  const normalizedName = name.toLowerCase()
  const alreadyTracked = trackedRenewals.some((renewal, index) =>
    index !== editingIndex && renewal.name.trim().toLowerCase() === normalizedName && renewal.dueDate === date
  )
  if (alreadyTracked) {
    showToast("That permit is already tracked for this due date.")
    return
  }
  if (editingIndex < 0 && trackedRenewals.length >= maxTrackedRenewals) {
    showToast(`Civra can track up to ${maxTrackedRenewals} renewal reminders in this browser.`)
    return
  }

  const isEditing = editingIndex >= 0
  if (isEditing) trackedRenewals[editingIndex] = { name, dueDate: date }
  else trackedRenewals.push({ name, dueDate: date })
  const saved = saveRenewals()
  renderRenewals()
  closeRenewalForm()
  showAndFocus(permitsCard)
  showToast(saved
    ? `${name} was ${isEditing ? "updated" : "saved"} in this browser for renewal review.`
    : `${name} was ${isEditing ? "updated" : "added"} for this page, but the browser could not save the reminder.`
  )
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
    const budgetNote = Number.isInteger(result.remainingPermitChecks)
      ? ` ${result.remainingPermitChecks} live permit check${result.remainingPermitChecks === 1 ? "" : "s"} ${result.remainingPermitChecks === 1 ? "remains" : "remain"} in this session.`
      : ""
    const snapshot = result.sourceSnapshot || {}
    const snapshotNote = snapshot.change === "changed"
      ? " The official page changed since the previous snapshot; review the evidence before relying on it."
      : snapshot.change === "first_observation"
        ? " A new source snapshot was recorded for future change detection."
        : ""
    liveStatus.textContent = missing === 0
      ? `Live check done. All ${found} permit needs were found on the city page.${note}${budgetNote}${snapshotNote}`
      : `Live check done. ${found} found and ${missing} not found on the city page. Please review.${note}${budgetNote}${snapshotNote}`
    loadSourceHistory()
  } catch (error) {
    liveStatus.textContent = error instanceof Error ? error.message : "The city check failed."
  } finally {
    liveCheck.disabled = false
  }
})

function showSession(session) {
  sessionOpen = Boolean(session && session.authenticated)
  liveCheck.disabled = !sessionOpen
  accessForm.hidden = sessionOpen
  signOut.hidden = !sessionOpen
  updateDocumentButton()
  const permitBudget = Number.isInteger(session && session.remainingPermitChecks)
    ? ` ${session.remainingPermitChecks} live permit check${session.remainingPermitChecks === 1 ? "" : "s"} ${session.remainingPermitChecks === 1 ? "remains" : "remain"}.`
    : ""
  const documentBudget = Number.isInteger(session && session.remainingDocumentChecks)
    ? ` ${session.remainingDocumentChecks} document check${session.remainingDocumentChecks === 1 ? "" : "s"} ${session.remainingDocumentChecks === 1 ? "remains" : "remain"}.`
    : ""
  liveStatus.textContent = sessionOpen
    ? "Live check is unlocked for this browser." + permitBudget + documentBudget
    : "Unlock before using the paid Solari check."
  loadSourceHistory()
}

async function syncSession() {
  try {
    const response = await fetch("/api/session")
    const result = await response.json()
    showSession(result)
  } catch {
    showSession({ authenticated: false })
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
    showSession(result)
  } catch (error) {
    showSession({ authenticated: false })
    liveStatus.textContent = error instanceof Error ? error.message : "The access code was not accepted."
  }
})

signOut.addEventListener("click", async () => {
  clearSelectedFile()
  clearDocumentReport()
  fileOk.textContent = "Civra was locked; the selected file and result were cleared."
  try {
    const response = await fetch("/api/session", { method: "DELETE" })
    const result = await response.json()
    showSession(result)
  } catch {
    showSession({ authenticated: false })
  }
})

document.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    keepTabFocusInDialog(event)
    return
  }
  if (event.key !== "Escape") return
  if (guide.classList.contains("show")) {
    closeGuide()
    return
  }
  if (permitForm.classList.contains("show")) {
    closeRenewalForm()
    return
  }
  if (sheet.classList.contains("show")) {
    closeSheet()
    return
  }
  if (!sourceEvidence.hidden) hideSourceEvidence()
})

window.addEventListener("storage", event => {
  if (event.key !== null && event.key !== renewalStorageKey) return
  trackedRenewals = loadRenewals()
  renderRenewals()
})

renderTodayHeader()
renderRenewals()
scheduleDailyRefresh()
syncSession()
loadLiveProof()
