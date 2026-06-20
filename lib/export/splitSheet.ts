/**
 * Songwriter split-sheet generator — a signable PDF that records who owns what
 * BEFORE the release goes out. Unsigned splits are one of the most common indie
 * blow-ups: the money lands, then the argument starts. This turns the metadata the
 * user already typed (songwriters + writer splits + ISWC) into a real document they
 * can sign and keep — an artifact a chatbot can't produce and a distributor doesn't.
 *
 * Client-side, reuses the jsPDF dependency already in the project. Brand-light on
 * purpose so the pending product rename is a one-line change.
 */

import type { TrackMeta } from "@/lib/validation/types";

const TEAL = [13, 148, 136] as const;
const DARK = [22, 22, 26] as const;
const MUTED = [110, 110, 120] as const;
const LINE = [200, 200, 205] as const;

export type SplitParty = { name: string; share: number | null };

/** Parse a free-text splits field ("Jane Doe 50%, John Roe 50%") into parties. */
export function parseSplitParties(splits: string): SplitParty[] {
  if (!splits?.trim()) return [];
  return splits
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/(\d+(?:\.\d+)?)\s*%/);
      const share = m ? parseFloat(m[1]) : null;
      const name = entry.replace(/(\d+(?:\.\d+)?)\s*%/, "").replace(/[-–—:]+/g, " ").replace(/\s+/g, " ").trim();
      return { name: name || entry, share };
    });
}

/** Names from a comma/`&`/`and`-separated credit field, minus any already in parties. */
function extraNames(field: string | undefined, already: Set<string>): string[] {
  if (!field?.trim()) return [];
  return field
    .split(/[,;]|\s+&\s+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s && !already.has(s.toLowerCase()));
}

export async function exportSplitSheet(track: TrackMeta, filename = "split-sheet.pdf"): Promise<void> {
  // Lazy-load jsPDF so the ~130 kB library stays out of the /validate page bundle
  // (only pulled when a user actually downloads a sheet) — same pattern as the OCR engine.
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 0;

  // White page + teal accent bar.
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, 297, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Songwriter Split Sheet", 14, 11);

  y = 30;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(track.title || "Untitled", 14, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  const perf = track.artist || "—";
  doc.text(`Performed by ${perf}` + (track.album ? ` · ${track.album}` : ""), 14, y);
  y += 6;
  doc.text(`Date prepared: ${new Date().toLocaleDateString()}`, 14, y);
  if (track.iswc?.trim()) { y += 6; doc.text(`ISWC: ${track.iswc.trim()}`, 14, y); }
  y += 12;

  // ── Writers table ───────────────────────────────────────────────────────────
  const parties = parseSplitParties(track.splits || "");
  const namesSeen = new Set(parties.map((p) => p.name.toLowerCase()));
  // Add any songwriters/composers not already represented in the splits (0% → to fill).
  for (const n of [...extraNames(track.songwriters, namesSeen), ...extraNames(track.composers, namesSeen)]) {
    parties.push({ name: n, share: null });
    namesSeen.add(n.toLowerCase());
  }
  if (parties.length === 0) parties.push({ name: "", share: null }, { name: "", share: null });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const cols = { name: 16, role: 78, pro: 110, share: 150, sign: 172 };
  doc.text("WRITER (LEGAL NAME)", cols.name, y);
  doc.text("ROLE", cols.role, y);
  doc.text("PRO / IPI", cols.pro, y);
  doc.text("SHARE", cols.share, y);
  doc.text("SIGNATURE", cols.sign, y);
  y += 2;
  doc.setDrawColor(...LINE);
  doc.line(14, y, pageW - 14, y);
  y += 7;

  let total = 0;
  let anyShare = false;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  for (const p of parties) {
    if (p.share != null) { total += p.share; anyShare = true; }
    doc.text(p.name || "________________", cols.name, y);
    doc.setTextColor(...MUTED);
    doc.text("Writer", cols.role, y);
    doc.text("__________", cols.pro, y);
    doc.setTextColor(...DARK);
    doc.text(p.share != null ? `${p.share}%` : "______", cols.share, y);
    doc.setDrawColor(...LINE);
    doc.line(cols.sign, y + 0.5, pageW - 14, y + 0.5);
    y += 11;
  }

  // Total + balance check.
  y += 1;
  doc.setDrawColor(...LINE);
  doc.line(14, y, pageW - 14, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  if (anyShare) {
    const balanced = Math.abs(total - 100) < 0.5;
    doc.setTextColor(...(balanced ? DARK : ([180, 40, 50] as unknown as typeof DARK)));
    doc.text(`Total share: ${total}%${balanced ? "" : "  — must equal 100% before signing"}`, cols.name, y);
  } else {
    doc.setTextColor(...MUTED);
    doc.text("Total share: ____ %  (fill each writer's agreed share — must total 100%)", cols.name, y);
  }
  y += 14;

  // ── Producers (informational) ───────────────────────────────────────────────
  if (track.producers?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("PRODUCTION CREDITS", cols.name, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(track.producers.trim(), cols.name, y);
    y += 12;
  }

  // ── Agreement statement ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const statement =
    "The undersigned confirm the above ownership shares of the musical composition identified above, " +
    "and that each is a co-writer entitled to the share listed. This sheet should be completed and signed " +
    "by all writers before the recording is released and registered with your PRO and the MLC.";
  for (const line of doc.splitTextToSize(statement, pageW - 28)) {
    doc.text(line, cols.name, y);
    y += 4.6;
  }

  // Footer (brand-light — single point to change at rename).
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Split sheet generated ${new Date().toLocaleDateString()} · keep a signed copy with your release records`, pageW / 2, 290, { align: "center" });

  doc.save(filename);
}
