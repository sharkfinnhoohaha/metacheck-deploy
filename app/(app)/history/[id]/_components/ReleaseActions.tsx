"use client";

import { exportCsv } from "@/lib/export/csv";
import { exportPdf } from "@/lib/export/pdf";
import type { TrackMeta, ValidationResult } from "@/lib/validation/types";

export function ReleaseActions({
  tracks,
  results,
  releaseTitle,
}: {
  tracks: TrackMeta[];
  results: ValidationResult[];
  releaseTitle: string;
}) {
  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button
        onClick={() => exportCsv(tracks, `${releaseTitle}-clean.csv`)}
        className="px-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-muted font-mono hover:text-text transition-colors"
      >
        Export CSV
      </button>
      <button
        onClick={() => exportPdf(tracks, results, `${releaseTitle}-report.pdf`)}
        className="px-4 py-2 rounded-lg bg-surface border border-border text-xs text-text-muted font-mono hover:text-text transition-colors"
      >
        Export PDF
      </button>
    </div>
  );
}
