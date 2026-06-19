import Stripe from "stripe";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Tier = "pro" | "team";
export type Interval = "month" | "year";

/** Resolve the Stripe price ID for a tier + billing interval. */
export function priceIdFor(tier: Tier, interval: Interval): string | undefined {
  if (interval === "year") {
    return tier === "pro" ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID : process.env.STRIPE_TEAM_ANNUAL_PRICE_ID;
  }
  return tier === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_TEAM_PRICE_ID;
}

export async function createCheckoutSession(
  clerkId: string,
  email: string,
  tier: Tier,
  interval: Interval = "month"
): Promise<string> {
  const priceId = priceIdFor(tier, interval);
  if (!priceId) throw new Error(`No Stripe price configured for ${tier}/${interval}`);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    metadata: { clerk_id: clerkId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return session.url!;
}

/**
 * One-time "Per Release" purchase → grants release credits (fulfilled in the
 * webhook). Uses mode: "payment", not a subscription.
 */
export async function createReleaseCreditCheckout(
  clerkId: string,
  email: string,
  qty = 1
): Promise<string> {
  const priceId = process.env.STRIPE_PER_RELEASE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PER_RELEASE_PRICE_ID is not configured");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: qty }],
    customer_email: email,
    // `kind` + `credits` are read back in the webhook to fulfil the purchase.
    metadata: { clerk_id: clerkId, kind: "release_credit", credits: String(qty) },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?credits=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return session.url!;
}

export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });
  return session.url;
}
