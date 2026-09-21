const crypto = require("crypto")
const fs = require("fs/promises")
const path = require("path")

const defaultDirectory = process.env.CIVRA_SOURCE_SNAPSHOT_DIR ||
  path.join(__dirname, "data", "source-snapshots")

function snapshotIdFor(fingerprint) {
  if (!/^[a-f0-9]{64}$/.test(String(fingerprint || ""))) {
    throw new Error("A SHA-256 source fingerprint is required to record a snapshot.")
  }
  return fingerprint
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"))
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    throw error
  }
}

async function writeJsonAtomically(file, value) {
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`
  )
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", "utf8")
  await fs.rename(temporary, file)
}

function publicSnapshot(check, snapshotId, observedAt, existing, previousSnapshotId) {
  return {
    schemaVersion: 2,
    snapshotId,
    source: check.source || null,
    finalUrl: check.finalUrl || null,
    title: check.title || null,
    sourceFingerprint: check.sourceFingerprint,
    pageVerified: Boolean(check.pageVerified),
    reasons: Array.isArray(check.reasons) ? check.reasons : [],
    checks: check.checks || {},
    firstObservedAt: existing ? existing.firstObservedAt : observedAt,
    lastObservedAt: observedAt,
    observationCount: (existing?.observationCount || 0) + 1,
    previousSnapshotId: previousSnapshotId || null
  }
}

function comparableCheck(check) {
  if (!check) return null
  return {
    label: check.label || null,
    status: check.status || "unknown",
    reason: check.reason || null,
    evidence: check.evidence || null
  }
}

function checksEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function compareSnapshots(current, previous) {
  if (!current || !previous) {
    return { changes: [], unchangedCount: 0 }
  }

  const currentChecks = current.checks || {}
  const previousChecks = previous.checks || {}
  const keys = [...new Set([...Object.keys(previousChecks), ...Object.keys(currentChecks)])].sort()
  const changes = []
  let unchangedCount = 0

  for (const key of keys) {
    const before = comparableCheck(previousChecks[key])
    const after = comparableCheck(currentChecks[key])
    if (checksEqual(before, after)) {
      unchangedCount += 1
      continue
    }
    changes.push({
      key,
      label: after?.label || before?.label || key,
      kind: before && after ? "changed" : before ? "removed" : "added",
      before,
      after
    })
  }

  return { changes, unchangedCount }
}

function createSourceSnapshotStore({ directory = defaultDirectory } = {}) {
  const indexFile = path.join(directory, "index.json")

  async function record(check) {
    const snapshotId = snapshotIdFor(check.sourceFingerprint)
    const observedAt = check.checkedAt || new Date().toISOString()
    const snapshotFile = path.join(directory, `${snapshotId}.json`)

    await fs.mkdir(directory, { recursive: true })

    const [index, existing] = await Promise.all([
      readJson(indexFile),
      readJson(snapshotFile)
    ])
    const previousSnapshotId = index?.latestSnapshotId || null
    const change = previousSnapshotId === snapshotId
      ? "unchanged"
      : previousSnapshotId
        ? "changed"
        : "first_observation"

    await writeJsonAtomically(
      snapshotFile,
      publicSnapshot(check, snapshotId, observedAt, existing, previousSnapshotId)
    )
    await writeJsonAtomically(indexFile, {
      schemaVersion: 1,
      latestSnapshotId: snapshotId,
      updatedAt: observedAt
    })

    return {
      snapshotId,
      change,
      previousSnapshotId,
      observedAt
    }
  }

  function publicEvidence(snapshot) {
    if (!snapshot) return null
    return {
      snapshotId: snapshot.snapshotId,
      source: snapshot.source,
      finalUrl: snapshot.finalUrl,
      title: snapshot.title,
      sourceFingerprint: snapshot.sourceFingerprint,
      pageVerified: snapshot.pageVerified,
      reasons: snapshot.reasons,
      checks: snapshot.checks,
      firstObservedAt: snapshot.firstObservedAt,
      lastObservedAt: snapshot.lastObservedAt,
      observationCount: snapshot.observationCount,
      previousSnapshotId: snapshot.previousSnapshotId || null
    }
  }

  async function get(snapshotId) {
    const validSnapshotId = snapshotIdFor(snapshotId)
    const snapshot = await readJson(path.join(directory, `${validSnapshotId}.json`))
    return publicEvidence(snapshot)
  }

  async function compare(snapshotId) {
    const current = await get(snapshotId)
    if (!current || !current.previousSnapshotId) {
      return { current, previous: null, changes: [], unchangedCount: 0 }
    }
    const previous = await get(current.previousSnapshotId)
    const comparison = compareSnapshots(current, previous)
    return { current, previous, ...comparison }
  }

  async function list({ limit = 10 } = {}) {
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error && error.code === "ENOENT") return []
      throw error
    }

    const snapshots = await Promise.all(
      entries
        .filter(entry => entry.isFile() && /^[a-f0-9]{64}\.json$/.test(entry.name))
        .map(entry => readJson(path.join(directory, entry.name)))
    )

    return snapshots
      .filter(Boolean)
      .sort((left, right) => String(right.lastObservedAt).localeCompare(String(left.lastObservedAt)))
      .slice(0, Math.max(0, limit))
      .map(snapshot => {
        const evidence = publicEvidence(snapshot)
        return {
          snapshotId: evidence.snapshotId,
          source: evidence.source,
          finalUrl: evidence.finalUrl,
          title: evidence.title,
          pageVerified: evidence.pageVerified,
          reasons: evidence.reasons,
          firstObservedAt: evidence.firstObservedAt,
          lastObservedAt: evidence.lastObservedAt,
          observationCount: evidence.observationCount,
          previousSnapshotId: evidence.previousSnapshotId
        }
      })
  }

  return { directory, record, get, compare, list }
}

module.exports = { createSourceSnapshotStore, snapshotIdFor, compareSnapshots }
