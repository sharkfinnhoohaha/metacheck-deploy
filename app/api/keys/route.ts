import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureUser, getUserTier } from "@/lib/auth";
import { generateApiKey } from "@/lib/apikey";

const MAX_ACTIVE_KEYS = 10;

function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205";
}

const CreateSchema = z.object({ name: z.string().trim().max(60).optional() });

// POST /api/keys — mint a Label API key (plaintext returned ONCE).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  if ((await getUserTier(userId)) !== "team") {
    return Response.json({ data: null, error: "API access is a Label-plan feature." }, { status: 403 });
  }

  const user = await currentUser();
  await ensureUser(userId, user?.emailAddresses[0]?.emailAddress ?? "", user?.firstName ?? undefined);

  let name: string | undefined;
  try {
    name = CreateSchema.parse(await req.json().catch(() => ({}))).name;
  } catch {
    return Response.json({ data: null, error: "Invalid body." }, { status: 400 });
  }

  // Soft cap on active keys per account.
  const { count, error: countErr } = await supabaseAdmin
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("clerk_id", userId)
    .is("revoked_at", null);
  if (countErr) {
    if (isMissingTable(countErr)) return Response.json({ data: null, error: "API is being set up — try again shortly." }, { status: 503 });
    console.error("api_keys count error:", countErr);
    return Response.json({ data: null, error: "Couldn't create key." }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return Response.json({ data: null, error: `You already have ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` }, { status: 400 });
  }

  const { plaintext, hash, prefix } = generateApiKey();
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({ clerk_id: userId, key_hash: hash, name: name || null, prefix })
    .select("id, name, prefix, created_at")
    .single();
  if (error) {
    if (isMissingTable(error)) return Response.json({ data: null, error: "API is being set up — try again shortly." }, { status: 503 });
    console.error("api_keys insert error:", error);
    return Response.json({ data: null, error: "Couldn't create key." }, { status: 500 });
  }

  // The ONLY time the plaintext is ever returned.
  return Response.json({ data: { ...data, key: plaintext }, error: null });
}

// GET /api/keys — list the caller's active keys (never the hash/plaintext).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, prefix, last_used_at, created_at")
    .eq("clerk_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  // Pre-migration: degrade to an empty list so the settings page still renders.
  if (error) return Response.json({ data: { keys: isMissingTable(error) ? [] : [] }, error: null });
  return Response.json({ data: { keys: data ?? [] }, error: null });
}

// DELETE /api/keys?id=… — revoke one of the caller's keys.
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ data: null, error: "Missing key id." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clerk_id", userId); // scope to owner — can't revoke someone else's key
  if (error) {
    console.error("api_keys revoke error:", error);
    return Response.json({ data: null, error: "Couldn't revoke key." }, { status: 500 });
  }
  return Response.json({ data: { revoked: true }, error: null });
}
