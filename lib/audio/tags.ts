/**
 * Read the metadata EMBEDDED in an audio file's container — ID3v2 (MP3), RIFF
 * INFO/bext (WAV), and Vorbis comments (FLAC). Best-effort and dependency-free;
 * runs on the same bytes we already read for decoding, in the browser.
 *
 * Why this matters: the file itself often carries an ISRC / title that disagrees
 * with what the artist types into their distributor — a mismatch that quietly
 * misroutes royalties or splits a release. A chatbot can't see inside the file;
 * this can. Unknown/foreign containers (M4A/AAC/OGG) just return no tags.
 */

export type EmbeddedTags = {
  title?: string;
  artist?: string;
  album?: string;
  isrc?: string;
  bpm?: string;
  key?: string;
  comment?: string;
  /** Container we managed to read tags from, or null. */
  source: "id3" | "riff" | "flac" | null;
};

const EMPTY: EmbeddedTags = { source: null };

function ascii(b: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const synchsafe = (b: Uint8Array, o: number) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

function decodeText(b: Uint8Array, encoding: number): string {
  try {
    const label = encoding === 0 ? "iso-8859-1" : encoding === 1 ? "utf-16" : encoding === 2 ? "utf-16be" : "utf-8";
    return new TextDecoder(label).decode(b).replace(/\0+$/g, "").trim();
  } catch {
    return ascii(b, 0, b.length).replace(/\0+$/g, "").trim();
  }
}

function clean(s?: string): string | undefined {
  const t = s?.replace(/\0/g, "").trim();
  return t ? t : undefined;
}

// ── ID3v2 (MP3) ──────────────────────────────────────────────────────────────
function parseId3(b: Uint8Array): EmbeddedTags | null {
  if (ascii(b, 0, 3) !== "ID3") return null;
  const major = b[3];
  if (major !== 3 && major !== 4) return { source: "id3" }; // v2.2 unsupported — acknowledge container
  const size = synchsafe(b, 6);
  const end = Math.min(10 + size, b.length);
  const out: EmbeddedTags = { source: "id3" };
  let off = 10;
  while (off + 10 <= end) {
    const id = ascii(b, off, off + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // hit padding
    const fsize = major === 4 ? synchsafe(b, off + 4) : ((b[off + 4] << 24) | (b[off + 5] << 16) | (b[off + 6] << 8) | b[off + 7]) >>> 0;
    const dataStart = off + 10;
    if (fsize <= 0 || dataStart + fsize > end) break;
    const data = b.subarray(dataStart, dataStart + fsize);
    if (id[0] === "T") {
      const text = decodeText(data.subarray(1), data[0]);
      if (id === "TIT2") out.title = text;
      else if (id === "TPE1") out.artist = text;
      else if (id === "TALB") out.album = text;
      else if (id === "TSRC") out.isrc = text;
      else if (id === "TBPM") out.bpm = text;
      else if (id === "TKEY") out.key = text;
    } else if (id === "COMM" && data.length > 4) {
      // enc(1) + lang(3) + short-desc(null-terminated) + text
      const enc = data[0];
      let p = 4;
      const termLen = enc === 1 || enc === 2 ? 2 : 1;
      while (p < data.length && !(data[p] === 0 && (termLen === 1 || data[p + 1] === 0))) p += termLen;
      p += termLen;
      out.comment = decodeText(data.subarray(p), enc);
    }
    off = dataStart + fsize;
  }
  return normalize(out);
}

// ── RIFF / WAV ───────────────────────────────────────────────────────────────
function parseRiff(b: Uint8Array): EmbeddedTags | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 12) !== "WAVE") return null;
  const out: EmbeddedTags = { source: "riff" };
  let off = 12;
  while (off + 8 <= b.length) {
    const id = ascii(b, off, off + 4);
    const size = le32(b, off + 4);
    const dataStart = off + 8;
    if (id === "LIST" && ascii(b, dataStart, dataStart + 4) === "INFO") {
      let p = dataStart + 4;
      const listEnd = Math.min(dataStart + size, b.length);
      while (p + 8 <= listEnd) {
        const sid = ascii(b, p, p + 4);
        const ssize = le32(b, p + 4);
        const val = ascii(b, p + 8, p + 8 + ssize).replace(/\0+$/g, "").trim();
        if (sid === "INAM") out.title = val;
        else if (sid === "IART") out.artist = val;
        else if (sid === "IPRD") out.album = val;
        else if (sid === "ISRC") out.isrc = val;
        else if (sid === "ICMT") out.comment = val;
        p += 8 + ssize + (ssize % 2); // chunks are word-aligned
      }
    } else if (id === "bext") {
      // Broadcast-WAV: first 256 bytes are a free-text description.
      out.comment = out.comment || ascii(b, dataStart, dataStart + 256).replace(/\0+$/g, "").trim();
    }
    off = dataStart + size + (size % 2);
    if (size <= 0) break;
  }
  return normalize(out);
}

// ── FLAC (Vorbis comments) ───────────────────────────────────────────────────
function parseFlac(b: Uint8Array): EmbeddedTags | null {
  if (ascii(b, 0, 4) !== "fLaC") return null;
  const out: EmbeddedTags = { source: "flac" };
  let off = 4;
  while (off + 4 <= b.length) {
    const flag = b[off];
    const type = flag & 0x7f;
    const len = (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3];
    const dataStart = off + 4;
    if (type === 4) {
      let p = dataStart;
      const vlen = le32(b, p); p += 4 + vlen;
      const count = le32(b, p); p += 4;
      for (let i = 0; i < count && p + 4 <= b.length; i++) {
        const clen = le32(b, p); p += 4;
        const s = (() => { try { return new TextDecoder("utf-8").decode(b.subarray(p, p + clen)); } catch { return ascii(b, p, p + clen); } })();
        p += clen;
        const eq = s.indexOf("=");
        if (eq > 0) {
          const k = s.slice(0, eq).toUpperCase();
          const v = s.slice(eq + 1);
          if (k === "TITLE") out.title = v;
          else if (k === "ARTIST") out.artist = v;
          else if (k === "ALBUM") out.album = v;
          else if (k === "ISRC") out.isrc = v;
          else if (k === "BPM") out.bpm = v;
          else if (k === "KEY" || k === "INITIALKEY") out.key = v;
          else if (k === "COMMENT") out.comment = v;
        }
      }
      break;
    }
    off = dataStart + len;
    if (flag & 0x80) break; // last metadata block
  }
  return normalize(out);
}

function normalize(t: EmbeddedTags): EmbeddedTags {
  return {
    source: t.source,
    title: clean(t.title),
    artist: clean(t.artist),
    album: clean(t.album),
    isrc: clean(t.isrc),
    bpm: clean(t.bpm),
    key: clean(t.key),
    comment: clean(t.comment),
  };
}

export function readEmbeddedTags(buf: ArrayBuffer): EmbeddedTags {
  try {
    const b = new Uint8Array(buf);
    return parseId3(b) ?? parseRiff(b) ?? parseFlac(b) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Did we recover any human-meaningful tag (beyond just identifying the container)? */
export function hasEmbeddedData(t: EmbeddedTags): boolean {
  return !!(t.title || t.artist || t.album || t.isrc || t.bpm || t.key || t.comment);
}
