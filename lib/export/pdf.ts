import type { TrackMeta, ValidationResult } from "@/lib/validation/types";
import { getGrade } from "@/lib/validation/rules";
import jsPDF from "jspdf";

const TEAL = [13, 148, 136] as const;
const DARK = [22, 22, 26] as const;
const TEXT = [232, 230, 227] as const;
const MUTED = [138, 138, 149] as const;

export function exportPdf(
  tracks: TrackMeta[],
  results: ValidationResult[],
  filename = "metacheck-report.pdf"
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grade = getGrade(results);
  const pageW = doc.internal.pageSize.getWidth();
  let y = 0;

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkY = (needed: number) => {
    if (y + needed > 270) addPage();
  };

  // ── Cover header ────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, 297, "F");

  // Teal accent bar
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 18, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("MetaCheck Validation Report", 14, 12);

  y = 28;

  // Release title
  const releaseTitle = tracks[0]?.album || tracks[0]?.title || "Untitled Release";
  const artist = tracks[0]?.artist || "";
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(releaseTitle, 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text(`${artist} · ${tracks.length} track${tracks.length !== 1 ? "s" : ""} · ${new Date().toLocaleDateString()}`, 14, y);
  y += 14;

  // Grade block
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, 60, 28, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...TEAL);
  doc.text(grade.letter, 35, y + 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(grade.label, 35, y + 26, { align: "center" });

  // Summary stats beside grade
  const criticals = results.filter((r) => r.severity === "critical").length;
  const warnings = results.filter((r) => r.severity === "warning").length;
  const suggestions = results.filter((r) => r.severity === "suggestion").length;

  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(`${criticals}`, 84, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(" critical issues", 90, y + 8);

  doc.setFont("helvetica", "bold");
  doc.text(`${warnings}`, 84, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text(" warnings", 90, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text(`${suggestions}`, 84, y + 22);
  doc.setFont("helvetica", "normal");
  doc.text(" suggestions", 90, y + 22);

  y += 38;

  // ── Issues ──────────────────────────────────────────────────────────────────
  const SEV_LABELS: { sev: ValidationResult["severity"]; label: string; color: [number, number, number] }[] = [
    { sev: "critical", label: "Critical Issues", color: [244, 63, 94] },
    { sev: "warning", label: "Warnings", color: [245, 158, 11] },
    { sev: "suggestion", label: "Suggestions", color: [59, 130, 246] },
  ];

  for (const { sev, label, color } of SEV_LABELS) {
    const items = results.filter((r) => r.severity === sev);
    if (!items.length) continue;

    checkY(16);
    doc.setFillColor(...color);
    doc.rect(14, y - 1, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(label, 20, y + 6);
    y += 14;

    for (const item of items) {
      checkY(20);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      const trackLabel = item.trackIndex !== undefined ? `[Track ${item.trackIndex + 1}] ` : "";
      doc.text(`${trackLabel}${item.field}`, 20, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(item.message, pageW - 42);
      for (const line of lines) {
        checkY(5);
        doc.text(line, 20, y);
        y += 4.5;
      }

      if (item.suggestion) {
        checkY(5);
        doc.setTextColor(...TEAL);
        const sugLines = doc.splitTextToSize(`→ ${item.suggestion}`, pageW - 42);
        for (const line of sugLines) {
          checkY(5);
          doc.text(line, 20, y);
          y += 4.5;
        }
      }
      y += 3;
    }
    y += 4;
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`MetaCheck — Page ${i} of ${totalPages}`, pageW / 2, 290, { align: "center" });
  }

  doc.save(filename);
}
