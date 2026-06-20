import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureUser, getUserTier } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const TicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  email: z.string().trim().email().max(320).optional(),
});

// PostgREST "table not in schema cache" / Postgres "undefined_table" — i.e. the
// 005_support migration hasn't been applied yet. Degrade to 503 instead of 500.
function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const accountEmail = user?.emailAddresses[0]?.emailAddress ?? "";
  await ensureUser(userId, accountEmail, user?.firstName ?? undefined);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = TicketSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: "Please add a subject (3+ chars) and a message (10+ chars)." }, { status: 400 });
  }

  // Priority is derived SERVER-SIDE from the tier — never trusted from the client.
  const tier = await getUserTier(userId);
  const isPriority = tier === "pro" || tier === "team";

  // Spam cap, two layers, FAIL CLOSED. rateLimit no-ops when Upstash is absent,
  // so the DB COUNT below is the always-present hard limit.
  const rl = await rateLimit("support", userId, { requests: 5, windowSec: 3600 });
  if (!rl.success) {
    return Response.json({ data: null, error: "You've sent several messages recently — please give us a little time to respond." }, { status: 429 });
  }

  try {
    const sinceIso = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: countErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("clerk_id", userId)
      .gte("created_at", sinceIso);
    if (countErr) {
      if (isMissingTable(countErr)) {
        return Response.json({ data: null, error: "Support is being set up — please email hello@metacheck.app for now." }, { status: 503 });
      }
      throw countErr;
    }
    if ((count ?? 0) >= 5) {
      return Response.json({ data: null, error: "You've reached the hourly message limit — please give us a little time to respond." }, { status: 429 });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        clerk_id: userId,
        email: parsed.data.email || accountEmail,
        subject: parsed.data.subject,
        body: parsed.data.body,
        tier,
        priority: isPriority ? "priority" : "standard",
        priority_rank: isPriority ? 0 : 1,
      })
      .select("id")
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return Response.json({ data: null, error: "Support is being set up — please email hello@metacheck.app for now." }, { status: 503 });
      }
      throw error;
    }

    // Best-effort notification to an ops channel (Slack/Discord incoming webhook).
    // Never let an outage here fail the request the user just made.
    const hook = process.env.SUPPORT_WEBHOOK_URL;
    if (hook) {
      try {
        await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🎫 ${isPriority ? "PRIORITY" : "standard"} support (${tier}) from ${parsed.data.email || accountEmail}\n*${parsed.data.subject}*\n${parsed.data.body.slice(0, 1500)}`,
          }),
          signal: AbortSignal.timeout(4000),
        });
      } catch (hookErr) {
        console.error("Support webhook ping failed (ticket still saved):", hookErr);
      }
    }

    return Response.json({ data: { id: data.id }, error: null });
  } catch (err) {
    console.error("Support ticket error:", err);
    return Response.json({ data: null, error: "Couldn't submit your message — please try again." }, { status: 500 });
  }
}
