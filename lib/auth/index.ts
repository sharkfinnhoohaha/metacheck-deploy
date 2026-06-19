import { supabaseAdmin } from "@/lib/supabase/admin";

export type Tier = "free" | "pro" | "team";

const MONTHLY_VALIDATION_LIMITS: Record<Tier, number> = {
  free: 3,
  pro: Infinity,
  team: Infinity,
};

const MONTHLY_AI_LIMITS: Record<Tier, number> = {
  free: 0,
  pro: 300,
  team: 1500,
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Idempotently ensure a `users` row exists before any FK-dependent write
 * (usage / releases reference users.clerk_id). The Clerk webhook normally
 * creates this row, but it's asynchronous — a brand-new user can act before it
 * lands, which previously threw a raw Postgres FK error. `ignoreDuplicates`
 * means we never clobber an existing row's tier/credits.
 */
export async function ensureUser(clerkId: string, email: string, name?: string): Promise<void> {
  const { error } = await supabaseAdmin.from("users").upsert(
    { clerk_id: clerkId, email: email || "", name: name ?? null },
    { onConflict: "clerk_id", ignoreDuplicates: true }
  );
  if (error) console.error("ensureUser upsert error:", error);
}

export async function getUserTier(clerkId: string): Promise<Tier> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("tier")
    .eq("clerk_id", clerkId)
    .single();
  const tier = (data?.tier ?? "free") as Tier;
  if (!["free", "pro", "team"].includes(tier)) return "free";
  return tier;
}

async function getUsage(
  clerkId: string
): Promise<{ validations: number; ai_calls: number }> {
  const month = currentMonth();
  const { data } = await supabaseAdmin
    .from("usage")
    .select("validations, ai_calls")
    .eq("clerk_id", clerkId)
    .eq("month", month)
    .single();
  return { validations: data?.validations ?? 0, ai_calls: data?.ai_calls ?? 0 };
}

export async function getCredits(clerkId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("credits")
    .eq("clerk_id", clerkId)
    .single();
  return data?.credits ?? 0;
}

export async function canValidate(clerkId: string): Promise<boolean> {
  const tier = await getUserTier(clerkId);
  const limit = MONTHLY_VALIDATION_LIMITS[tier];
  if (limit === Infinity) return true;
  const { validations } = await getUsage(clerkId);
  return validations < limit;
}

export async function canUseAI(clerkId: string): Promise<boolean> {
  const tier = await getUserTier(clerkId);
  const limit = MONTHLY_AI_LIMITS[tier];
  if (limit === 0) return false;
  const { ai_calls } = await getUsage(clerkId);
  return ai_calls < limit;
}

/**
 * Atomically consume one release credit. Returns true if a credit was spent.
 * Backed by a Postgres function so concurrent saves can't double-spend.
 */
export async function consumeCredit(clerkId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("consume_credit", { p_clerk_id: clerkId });
  if (error) {
    console.error("consume_credit error:", error);
    return false;
  }
  return data !== null && data !== undefined; // NULL = no credit was available
}

/** Atomically grant release credits (called from billing webhooks). */
export async function addCredits(clerkId: string, qty: number): Promise<void> {
  const { error } = await supabaseAdmin.rpc("add_credits", { p_clerk_id: clerkId, p_qty: qty });
  if (error) console.error("add_credits error:", error);
}

/**
 * Atomically increment a usage counter and return the new value. Uses the
 * `increment_usage` Postgres function (003 migration) so concurrent requests
 * can't double-count — the old read-then-write was racy.
 */
export async function trackUsage(
  clerkId: string,
  type: "validation" | "ai_call"
): Promise<number> {
  const month = currentMonth();
  const column = type === "validation" ? "validations" : "ai_calls";

  const { data, error } = await supabaseAdmin.rpc("increment_usage", {
    p_clerk_id: clerkId,
    p_month: month,
    p_column: column,
  });

  if (error) {
    console.error("increment_usage error:", error);
    return 0;
  }
  return (data as number) ?? 0;
}
