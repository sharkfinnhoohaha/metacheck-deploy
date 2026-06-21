import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserTier } from "@/lib/auth";
import { BUILTIN_RULE_IDS } from "@/lib/validation/ruleCatalogue";

// The real TrackMeta string fields a custom check may target.
const TRACK_META_KEYS = [
  "trackNumber", "title", "artist", "featuredArtists", "album", "isrc", "upc",
  "genre", "releaseDate", "label", "songwriters", "producers", "composers",
  "copyright", "explicit", "language", "duration", "iswc", "splits", "bpm",
  "musicalKey", "moodTags", "instrumentalAvailable", "cleanVersionAvailable",
  "stemsAvailable", "oneStopClearance", "licensingContact", "aiDisclosure",
] as const;

const Severity = z.enum(["critical", "warning", "suggestion"]);
const Override = z.enum(["critical", "warning", "suggestion", "off"]);

const CheckSchema = z.object({
  id: z.string().trim().min(1).max(40),
  field: z.enum(TRACK_META_KEYS),
  type: z.enum(["required", "regex"]),
  pattern: z.string().max(300).optional(),
  severity: Severity,
  message: z.string().trim().min(1).max(200),
});

const ConfigSchema = z.object({
  // Reject unknown rule ids so a stored override can never silently orphan.
  severityOverrides: z
    .record(z.string(), Override)
    .refine((o) => Object.keys(o).every((k) => BUILTIN_RULE_IDS.has(k)), { message: "Unknown rule id in severityOverrides" }),
  customChecks: z.array(CheckSchema).max(50),
});

function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205";
}

// GET — the caller's config, or null. Not tier-gated (returns null for non-Label,
// which the client treats as "no custom rules"); pre-migration also returns null.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("rule_configs")
    .select("severity_overrides, custom_checks")
    .eq("clerk_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116" || isMissingTable(error)) {
      return Response.json({ data: { config: null }, error: null });
    }
    console.error("rule-config GET error:", error);
    return Response.json({ data: { config: null }, error: null });
  }
  return Response.json({
    data: { config: { severityOverrides: data.severity_overrides ?? {}, customChecks: data.custom_checks ?? [] } },
    error: null,
  });
}

// PUT — save the caller's config. Label-only.
export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if ((await getUserTier(userId)) !== "team") {
    return Response.json({ data: null, error: "Custom rules are a Label-plan feature." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ConfigSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid config" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("rule_configs").upsert(
    {
      clerk_id: userId,
      severity_overrides: parsed.data.severityOverrides,
      custom_checks: parsed.data.customChecks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_id" }
  );
  if (error) {
    if (isMissingTable(error)) return Response.json({ data: null, error: "Custom rules are being set up — try again shortly." }, { status: 503 });
    console.error("rule-config PUT error:", error);
    return Response.json({ data: null, error: "Couldn't save config." }, { status: 500 });
  }
  return Response.json({ data: { saved: true }, error: null });
}
