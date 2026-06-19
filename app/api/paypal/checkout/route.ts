import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSubscription } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const schema = z.enum(["pro", "team"]);
const intervalSchema = z.enum(["month", "year"]).default("month");

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.redirect(new URL("/sign-in", req.url));

  const url = new URL(req.url);
  const tier = schema.safeParse(url.searchParams.get("tier"));
  if (!tier.success) {
    return Response.redirect(new URL("/settings?error=invalid_tier", req.url));
  }
  const interval = intervalSchema.parse(url.searchParams.get("interval") ?? undefined);

  const user = await currentUser();
  if (!user) return Response.redirect(new URL("/sign-in", req.url));

  const email = user.emailAddresses[0]?.emailAddress ?? "";

  // Ensure the user exists in the DB before redirecting to PayPal.
  await supabaseAdmin.from("users").upsert(
    { clerk_id: userId, email, name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() },
    { onConflict: "clerk_id", ignoreDuplicates: false }
  );

  try {
    const approvalUrl = await createSubscription(userId, email, tier.data, interval);
    redirect(approvalUrl);
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("PayPal checkout error:", err);
    return Response.redirect(new URL("/settings?error=checkout_failed", req.url));
  }
}
