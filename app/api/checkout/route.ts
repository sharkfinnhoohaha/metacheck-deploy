import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createCheckoutSession, createReleaseCreditCheckout } from "@/lib/stripe";
import { ensureUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const tierSchema = z.enum(["pro", "team"]);
const intervalSchema = z.enum(["month", "year"]).default("month");

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.redirect(new URL("/sign-in", req.url));

  const user = await currentUser();
  if (!user) return Response.redirect(new URL("/sign-in", req.url));
  const email = user.emailAddresses[0]?.emailAddress ?? "";

  // Ensure the user row exists before checkout so the webhook can find it.
  await ensureUser(userId, email, user.firstName ?? undefined);

  const url = new URL(req.url);

  try {
    // One-time per-release credit purchase: /api/checkout?product=release_credit
    if (url.searchParams.get("product") === "release_credit") {
      const checkoutUrl = await createReleaseCreditCheckout(userId, email);
      redirect(checkoutUrl);
    }

    // Subscription: /api/checkout?tier=pro|team&interval=month|year
    const tier = tierSchema.safeParse(url.searchParams.get("tier"));
    if (!tier.success) {
      return Response.redirect(new URL("/settings?error=invalid_tier", req.url));
    }
    const interval = intervalSchema.parse(url.searchParams.get("interval") ?? undefined);

    const checkoutUrl = await createCheckoutSession(userId, email, tier.data, interval);
    redirect(checkoutUrl);
  } catch (err) {
    // redirect() throws a control-flow signal — rethrow it untouched.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("Checkout error:", err);
    return Response.redirect(new URL("/settings?error=checkout_failed", req.url));
  }
}
