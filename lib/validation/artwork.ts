import type { ArtworkCheckResult } from "./types";

const MIN_DIMENSION = 3000;
const MAX_FILE_BYTES = 36 * 1024 * 1024; // DSPs typically cap cover art around 36MB

/**
 * Inspect a JPEG's Start-Of-Frame marker for a 4-component (CMYK) frame.
 * CMYK cover art renders with wrong/garish colours on DSPs and is a common
 * rejection cause, but a browser <img>/canvas silently converts it to RGB —
 * so we read the file bytes directly instead. Returns null if not a JPEG.
 */
function detectJpegCmyk(buf: ArrayBuffer): boolean | null {
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG
  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    // SOF0–SOF15, excluding the non-frame markers C4 (DHT), C8 (JPG), CC (DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      // segment: FF(1) marker(1) len(2) precision(1) height(2) width(2) components(1)
      return view.getUint8(offset + 9) === 4;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // standalone markers, no length
      continue;
    }
    const len = view.getUint16(offset + 2);
    if (len < 2) break;
    offset += 2 + len;
  }
  return false;
}

async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

/**
 * Check cover artwork against DSP submission specs. Runs entirely client-side and
 * instantly. Text/handle detection is a separate, opt-in OCR pass (scanArtworkText).
 */
export async function checkArtworkFile(file: File): Promise<ArtworkCheckResult[]> {
  const out: ArtworkCheckResult[] = [];

  // ── Format ────────────────────────────────────────────────────────
  const type = file.type.toLowerCase();
  const isJpeg = type === "image/jpeg" || type === "image/jpg";
  const isPng = type === "image/png";
  if (!isJpeg && !isPng) {
    out.push({
      severity: "critical",
      rule: "artwork_format",
      message: `Artwork is ${file.type || "an unsupported type"} — DSPs require a JPG or PNG.`,
    });
  }

  // ── File size ─────────────────────────────────────────────────────
  if (file.size > MAX_FILE_BYTES) {
    out.push({
      severity: "warning",
      rule: "artwork_filesize",
      message: `Artwork is ${(file.size / 1024 / 1024).toFixed(1)}MB — most distributors cap cover art near 36MB.`,
    });
  }

  // ── Dimensions / aspect ───────────────────────────────────────────
  const dims = await readDimensions(file);
  if (!dims) {
    out.push({
      severity: "warning",
      rule: "artwork_unreadable",
      message: "Couldn't read the image dimensions — make sure it's a valid, uncorrupted JPG or PNG.",
    });
  } else {
    if (dims.width !== dims.height) {
      out.push({
        severity: "critical",
        rule: "artwork_aspect",
        message: `Artwork is ${dims.width}×${dims.height} — cover art must be a perfect square.`,
      });
    }
    if (dims.width < MIN_DIMENSION || dims.height < MIN_DIMENSION) {
      out.push({
        severity: "critical",
        rule: "artwork_resolution",
        message: `Artwork is ${dims.width}×${dims.height} — DSPs require at least ${MIN_DIMENSION}×${MIN_DIMENSION}px.`,
      });
    }
  }

  // ── Colour space (JPEG CMYK) ──────────────────────────────────────
  if (isJpeg) {
    try {
      const cmyk = detectJpegCmyk(await file.arrayBuffer());
      if (cmyk) {
        out.push({
          severity: "critical",
          rule: "artwork_cmyk",
          message: "Artwork is CMYK — colours will look wrong on DSPs. Re-export as sRGB.",
        });
      }
    } catch {
      /* byte read failed — skip colour-space check */
    }
  }

  if (out.length === 0) {
    out.push({
      severity: "success",
      rule: "artwork_ok",
      message: `Looks good — square ${dims?.width}×${dims?.height}px ${isPng ? "PNG" : "JPG"}. Run the text scan to be sure there are no URLs or handles.`,
    });
  }

  return out;
}

/**
 * Opt-in OCR pass: detect text DSPs forbid in cover art — URLs, social handles,
 * email addresses, and release dates. Lazily loads tesseract.js so the ~2MB
 * OCR engine never touches the initial page bundle.
 */
export async function scanArtworkText(file: File): Promise<ArtworkCheckResult[]> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(file, "eng");
  const text = (data.text || "").trim();
  const found: ArtworkCheckResult[] = [];

  if (/\b(?:https?:\/\/|www\.)\S+/i.test(text) || /\b[\w-]+\.(?:com|net|org|io|co|fm|me|music|info)\b/i.test(text)) {
    found.push({ severity: "critical", rule: "artwork_url", message: "Detected a URL / website in the artwork — DSPs reject cover art containing web addresses." });
  }
  if (/@[A-Za-z0-9._]{2,}/.test(text)) {
    found.push({ severity: "critical", rule: "artwork_handle", message: "Detected a social handle (@…) in the artwork — remove it before submitting." });
  }
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) {
    found.push({ severity: "critical", rule: "artwork_email", message: "Detected an email address in the artwork — DSPs reject contact details on cover art." });
  }
  if (/\b(?:20\d{2})\b/.test(text) && /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[/-]\d{1,2})/i.test(text)) {
    found.push({ severity: "warning", rule: "artwork_date", message: "The artwork may contain a release date — DSPs generally reject dates on cover art." });
  }

  if (found.length === 0) {
    found.push({ severity: "success", rule: "artwork_text_ok", message: "No URLs, handles, emails or dates detected in the artwork." });
  }
  return found;
}
