import { auth } from "@clerk/nextjs/server";
import { cancelSubscription } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("paypal_subscription_id")
    .eq("clerk_id", userId)
    .single();

  if (!userData?.paypal_subscription_id) {
    return Response.json({ error: "No PayPal subscription found" }, { status: 404 });
  }

  await cancelSubscription(userData.paypal_subscription_id);

  // Optimistically downgrade; the BILLING.SUBSCRIPTION.CANCELLED webhook will
  // also fire and is idempotent.
  await supabaseAdmin
    .from("users")
    .update({ tier: "free", paypal_subscription_id: null })
    .eq("clerk_id", userId);

  redirect("/settings?paypal=cancelled");
}
