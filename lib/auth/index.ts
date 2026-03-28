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

export async function trackUsage(
  clerkId: string,
  type: "validation" | "ai_call"
): Promise<number> {
  const month = currentMonth();

  // Upsert usage row
  const { error: upsertErr } = await supabaseAdmin.from("usage").upsert(
    { clerk_id: clerkId, month, validations: 0, ai_calls: 0 },
    { onConflict: "clerk_id,month", ignoreDuplicates: true }
  );
  if (upsertErr) console.error("usage upsert error", upsertErr);

  const column = type === "validation" ? "validations" : "ai_calls";

  // Increment counter
  const { data } = await supabaseAdmin
    .from("usage")
    .select(column)
    .eq("clerk_id", clerkId)
    .eq("month", month)
    .single();

  const currentCount = (data as Record<string, number> | null)?.[column] ?? 0;
  const newCount = currentCount + 1;

  await supabaseAdmin
    .from("usage")
    .update({ [column]: newCount })
    .eq("clerk_id", clerkId)
    .eq("month", month);

  return newCount;
}
