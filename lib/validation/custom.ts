import type { TrackMeta, ValidationResult } from "./types";

export type Severity = "critical" | "warning" | "suggestion";
export type SeverityOverride = Severity | "off";

// A Label-defined check layered on top of the built-in engine. Declarative only
// (no code/eval) so it can be stored as data and run client-side.
export type CustomCheck = {
  id: string;
  field: string; // a TrackMeta key
  type: "required" | "regex";
  pattern?: string; // for type === "regex"
  severity: Severity;
  message: string;
};

export type RuleConfig = {
  severityOverrides: Record<string, SeverityOverride>;
  customChecks: CustomCheck[];
};

/**
 * Pure post-processor over the engine's output. Returns `results` UNCHANGED when
 * `cfg` is null/empty — this identity guarantee is what makes it safe to route
 * every validate() call through, since non-Label users always pass null.
 *
 *  - severityOverrides: remap a built-in rule's emitted severity, or "off" to drop it.
 *  - customChecks: per-track required/regex checks emitted as `custom_<id>` results.
 */
export function applyCustomRules(
  results: ValidationResult[],
  tracks: TrackMeta[],
  cfg: RuleConfig | null | undefined
): ValidationResult[] {
  if (!cfg) return results;

  let out = results;

  const overrides = cfg.severityOverrides ?? {};
  if (Object.keys(overrides).length > 0) {
    out = out.flatMap((r) => {
      const o = overrides[r.rule];
      if (!o) return [r];
      if (o === "off") return [];
      return [{ ...r, severity: o }];
    });
  }

  const checks = cfg.customChecks ?? [];
  if (checks.length > 0) {
    const extra: ValidationResult[] = [];
    tracks.forEach((t, i) => {
      const row = t as Record<string, string | undefined>;
      for (const c of checks) {
        const val = (row[c.field] ?? "").toString();
        let fail = false;
        if (c.type === "required") {
          fail = val.trim() === "";
        } else if (c.type === "regex" && c.pattern) {
          try {
            fail = !new RegExp(c.pattern).test(val);
          } catch {
            fail = false; // a malformed pattern never blocks the user
          }
        }
        if (fail) {
          extra.push({
            rule: `custom_${c.id}`,
            field: c.field,
            severity: c.severity,
            message: c.message,
            fixable: false,
            trackIndex: tracks.length > 1 ? i : undefined,
          });
        }
      }
    });
    out = [...out, ...extra];
  }

  return out;
}
