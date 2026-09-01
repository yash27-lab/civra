const crypto = require("crypto")
const { requirementSet } = require("./permit-requirements")

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_EXCERPT_CHARS = 800

const formats = Object.freeze({
  pdf: Object.freeze({ label: "PDF", mediaType: "application/pdf" }),
  jpeg: Object.freeze({ label: "JPEG", mediaType: "image/jpeg" }),
  png: Object.freeze({ label: "PNG", mediaType: "image/png" })
})

function identifySignature(bytes) {
  const file = Buffer.from(bytes || [])
  if (file.length >= 5 && file.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf"
  if (file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) return "jpeg"
  if (file.length >= 8 && file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png"
  return null
}

function normaliseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function excerpt(text, signal) {
  const body = String(text || "").replace(/\s+/g, " ").trim()
  const at = normaliseText(body).indexOf(normaliseText(signal))
  if (at === -1) return null
  return body.slice(Math.max(0, at - 80), Math.min(body.length, at + signal.length + 160)).trim().slice(0, MAX_EXCERPT_CHARS)
}

function makeChecklist(extraction) {
  const text = extraction.text || ""
  const normalised = normaliseText(text)

  return requirementSet.requirements.map(requirement => {
    if (!requirement.documentSignals) {
      return {
        key: requirement.key,
        label: requirement.label,
        status: "unknown",
        evidence: null,
        reason: "This requirement is not verified from an uploaded document."
      }
    }

    if (!extraction.textAvailable) {
      return {
        key: requirement.key,
        label: requirement.label,
        status: "unknown",
        evidence: null,
        reason: "Civra could not safely extract searchable text from this file."
      }
    }

    const matches = requirement.documentSignals.map(group => group.find(signal => normalised.includes(normaliseText(signal))))
    if (matches.every(Boolean)) {
      const evidence = excerpt(text, matches[0])
      return {
        key: requirement.key,
        label: requirement.label,
        status: "ready",
        evidence: evidence || matches.join("; "),
        reason: "Matching document evidence was found. The owner still needs to review that it is current and complete."
      }
    }

    return {
      key: requirement.key,
      label: requirement.label,
      status: "missing",
      evidence: null,
      reason: "This file does not show every expected signal for this requirement. That does not prove the requirement is absent."
    }
  })
}

// The extraction code is held as data and has no connection to uploaded text.
// It uses only the random guest path passed as an argv value; no shell is used.
const extractorProgram = String.raw`
import json, re, shutil, struct, subprocess, sys, zlib

path, expected = sys.argv[1], sys.argv[2]
data = open(path, "rb").read()

def signature(value):
    if value.startswith(b"%PDF-"): return "pdf"
    if value.startswith(b"\xff\xd8\xff"): return "jpeg"
    if value.startswith(b"\x89PNG\r\n\x1a\n"): return "png"
    return None

def jpeg_size(value):
    index = 2
    while index + 9 < len(value):
        if value[index] != 0xff:
            index += 1
            continue
        while index < len(value) and value[index] == 0xff:
            index += 1
        marker = value[index]
        index += 1
        if marker in (0xd8, 0xd9) or 0xd0 <= marker <= 0xd7:
            continue
        if index + 2 > len(value): break
        length = struct.unpack(">H", value[index:index + 2])[0]
        if length < 2 or index + length > len(value): break
        if 0xc0 <= marker <= 0xc3 or 0xc5 <= marker <= 0xc7 or 0xc9 <= marker <= 0xcb or 0xcd <= marker <= 0xcf:
            return struct.unpack(">H", value[index + 3:index + 5])[0], struct.unpack(">H", value[index + 5:index + 7])[0]
        index += length
    return None

def literal_fragments(value):
    fragments = []
    direct = re.findall(br"\((?:\\.|[^\\()]){1,600}\)\s*(?:Tj|')", value)
    arrays = re.findall(br"\[.{0,3000}?\]\s*TJ", value, re.S)
    for literal in direct + [item for array in arrays for item in re.findall(br"\((?:\\.|[^\\()]){1,600}\)", array)]:
        decoded = re.sub(br"\\([()\\])", br"\1", literal).decode("latin-1", "ignore")
        decoded = re.sub(r"\s+", " ", decoded).strip()
        if decoded: fragments.append(decoded)
    return fragments

def flate_text_streams(value):
    # Keep decompression bounded. A small compressed file must not expand into
    # unbounded work or memory inside the sandbox.
    streams = []
    pattern = re.compile(br"<<.{0,4096}?/FlateDecode.{0,4096}?>>\s*stream\r?\n(.{0,1048576}?)\r?\nendstream", re.S)
    for match in pattern.finditer(value):
        try:
            decoder = zlib.decompressobj()
            expanded = decoder.decompress(match.group(1), 250001)
            if decoder.unconsumed_tail or len(expanded) > 250000:
                continue
            expanded += decoder.flush(250001 - len(expanded))
            if len(expanded) <= 250000:
                streams.append(expanded)
        except zlib.error:
            continue
    return streams

actual = signature(data)
if actual != expected:
    raise ValueError("signature changed before extraction")

result = {"format": actual, "bytes": len(data), "textAvailable": False, "text": "", "metadata": {}}
if actual == "png":
    if len(data) < 24 or data[12:16] != b"IHDR": raise ValueError("invalid PNG header")
    width, height = struct.unpack(">II", data[16:24])
    result["metadata"] = {"width": width, "height": height}
elif actual == "jpeg":
    size = jpeg_size(data)
    if not size: raise ValueError("invalid JPEG structure")
    result["metadata"] = {"width": size[0], "height": size[1]}
else:
    # Prefer Poppler when it exists in the sandbox. It can read normal
    # compressed text streams without needing a network install.
    page_count = len(re.findall(br"/Type\s*/Page\b", data))
    text, text_method = "", "none"
    converter = shutil.which("pdftotext")
    if converter:
        try:
            converted = subprocess.run(
                [converter, "-f", "1", "-l", "25", "-layout", path, "-"],
                capture_output=True,
                check=False,
                timeout=10,
            )
            if converted.returncode == 0:
                text = converted.stdout.decode("utf-8", "ignore").strip()[:6000]
                if text: text_method = "pdftotext"
        except (OSError, subprocess.TimeoutExpired):
            pass

    # This conservative, dependency-free fallback handles simple PDFs when
    # Poppler is unavailable. Compressed/scanned PDFs remain unknown.
    if not text:
        fragments = literal_fragments(data)
        text = " ".join(fragments)[:6000]
        if text: text_method = "literal"
    if not text:
        fragments = [fragment for stream in flate_text_streams(data) for fragment in literal_fragments(stream)]
        text = " ".join(fragments)[:6000]
        if text: text_method = "flate-literal"
    metadata = {"pageCount": page_count if page_count else None}
    for key, label in ((b"Title", "title"), (b"Author", "author"), (b"Producer", "producer")):
        match = re.search(br"/" + key + br"\s*\((?:\\.|[^\\()]){0,200}\)", data)
        if match:
            value = match.group(0).split(b"(", 1)[-1].rstrip(b")").decode("latin-1", "ignore").strip()
            if value: metadata[label] = value[:200]
    result["metadata"] = metadata
    result["textAvailable"] = bool(text)
    result["text"] = text
    result["textMethod"] = text_method

print(json.dumps(result, separators=(",", ":")))
`

function validateExtraction(value, expectedFormat, expectedBytes) {
  if (!value || typeof value !== "object" || value.format !== expectedFormat) {
    throw new Error("Sandbox returned an invalid document result")
  }
  if (!Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_FILE_BYTES) {
    throw new Error("Sandbox returned an invalid document size")
  }
  if (expectedBytes !== undefined && value.bytes !== expectedBytes) {
    throw new Error("Sandbox returned a document with an unexpected size")
  }
  return {
    format: value.format,
    bytes: value.bytes,
    textAvailable: Boolean(value.textAvailable),
    text: String(value.text || "").slice(0, 6000),
    textMethod: ["pdftotext", "literal", "flate-literal", "none"].includes(value.textMethod) ? value.textMethod : "none",
    metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {}
  }
}

async function extractInSandbox({ apiKey, bytes, format }) {
  const { SolariClient } = await import("@solarisdk/sdk")
  const solari = new SolariClient({ apiKey })
  const sandbox = await solari.sandboxes.create({ template: "base", timeoutMs: 2 * 60 * 1000 })
  const filePath = `/tmp/civra-${crypto.randomUUID()}.${format}`

  try {
    await sandbox.connect()
    await sandbox.files.upload(filePath, bytes)
    const output = await sandbox.commands.run("python3", {
      args: ["-c", extractorProgram, filePath, format],
      timeoutMs: 30 * 1000
    })
    if (output.exitCode !== 0) throw new Error("Sandbox could not read the document")
    return validateExtraction(JSON.parse(output.stdout), format, bytes.length)
  } finally {
    // kill() destroys the VM and its ephemeral filesystem even if extraction fails.
    await sandbox.kill().catch(() => undefined)
  }
}

async function runDocumentVerification({ apiKey, bytes }) {
  const file = Buffer.from(bytes || [])
  if (!file.length || file.length > MAX_FILE_BYTES) throw new Error("INVALID_DOCUMENT_SIZE")

  const format = identifySignature(file)
  if (!format) throw new Error("UNSUPPORTED_DOCUMENT")

  const extraction = await extractInSandbox({ apiKey, bytes: file, format })
  const checklist = makeChecklist(extraction)
  const matched = checklist.filter(item => item.status === "ready").length

  return {
    checkedAt: new Date().toISOString(),
    retention: "The original file was processed in an ephemeral sandbox and deleted when that sandbox was destroyed.",
    document: {
      format: formats[format].label,
      mediaType: formats[format].mediaType,
      bytes: extraction.bytes,
      metadata: extraction.metadata,
      textExtracted: extraction.textAvailable,
      textMethod: extraction.textMethod
    },
    source: requirementSet.source,
    requirementVersion: requirementSet.version,
    summary: {
      ready: matched,
      missing: checklist.filter(item => item.status === "missing").length,
      unknown: checklist.filter(item => item.status === "unknown").length
    },
    checklist
  }
}

module.exports = {
  MAX_FILE_BYTES,
  identifySignature,
  makeChecklist,
  runDocumentVerification,
  validateExtraction
}
