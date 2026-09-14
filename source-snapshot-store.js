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

function publicSnapshot(check, snapshotId, observedAt, existing) {
  return {
    schemaVersion: 1,
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
    observationCount: (existing?.observationCount || 0) + 1
  }
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
      publicSnapshot(check, snapshotId, observedAt, existing)
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
        .filter(entry => entry.isFile() && /^[a-f0-9]{64}\\.json$/.test(entry.name))
        .map(entry => readJson(path.join(directory, entry.name)))
    )

    return snapshots
      .filter(Boolean)
      .sort((left, right) => String(right.lastObservedAt).localeCompare(String(left.lastObservedAt)))
      .slice(0, Math.max(0, limit))
      .map(snapshot => ({
        snapshotId: snapshot.snapshotId,
        source: snapshot.source,
        finalUrl: snapshot.finalUrl,
        title: snapshot.title,
        pageVerified: snapshot.pageVerified,
        reasons: snapshot.reasons,
        firstObservedAt: snapshot.firstObservedAt,
        lastObservedAt: snapshot.lastObservedAt,
        observationCount: snapshot.observationCount
      }))
  }

  return { directory, record, list }
}

module.exports = { createSourceSnapshotStore, snapshotIdFor }
