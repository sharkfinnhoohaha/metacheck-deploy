import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits, canValidate, consumeCredit, ensureUser, trackUsage } from "@/lib/auth";

const ReleaseSchema = z.object({
  title: z.string().min(1).max(500),
  artist: z.string().max(500).optional(),
  track_count: z.number().int().min(1).max(500),
  grade: z.string().max(2).optional(),
  critical_count: z.number().int().min(0).default(0),
  warning_count: z.number().int().min(0).default(0),
  suggestion_count: z.number().int().min(0).default(0),
  tracks: z.array(z.record(z.string(), z.string())).max(500),
  results: z.array(z.record(z.string(), z.unknown())).max(2000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  // Provision the users row up-front so the releases FK can never fail for a
  // brand-new user whose Clerk webhook hasn't landed yet.
  const user = await currentUser();
  await ensureUser(userId, user?.emailAddresses[0]?.emailAddress ?? "", user?.firstName ?? undefined);

  // Validate the payload BEFORE touching quota/credits — a malformed or oversized
  // body must never cost the user a paid release credit.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReleaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: "Invalid release payload." }, { status: 400 });
  }

  // Gate: within the monthly allowance, OR spend a one-time release credit.
  // The credit is consumed only after validation passed; if the insert then
  // fails we refund it, so a credit is never lost without a saved release.
  const allowedByQuota = await canValidate(userId);
  let usedCredit = false;
  if (!allowedByQuota) {
    usedCredit = await consumeCredit(userId);
    if (!usedCredit) {
      return Response.json(
        {
          data: null,
          error:
            "Monthly validation limit reached. Upgrade to Pro for unlimited saves, or buy a single release credit.",
        },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("releases")
    .insert({ ...parsed.data, clerk_id: userId })
    .select("id")
    .single();

  if (error) {
    console.error("release insert error:", error);
    if (usedCredit) await addCredits(userId, 1); // refund — the save didn't happen
    return Response.json({ data: null, error: "Couldn't save your release. Please try again." }, { status: 500 });
  }

  // Count monthly usage only when the save came out of the monthly allowance —
  // a credit-backed save shouldn't also burn a free-tier validation.
  if (!usedCredit) await trackUsage(userId, "validation");

  return Response.json({ data, error: null }, { status: 201 });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);

  const { data, error } = await supabaseAdmin
    .from("releases")
    .select("id, title, artist, grade, track_count, created_at, critical_count, warning_count, suggestion_count")
    .eq("clerk_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("releases list error:", error);
    return Response.json({ data: null, error: "Couldn't load your releases." }, { status: 500 });
  }
  return Response.json({ data, error: null });
}
