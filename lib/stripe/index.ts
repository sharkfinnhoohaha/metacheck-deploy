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

export async function createCheckoutSession(
  clerkId: string,
  email: string,
  tier: "pro" | "team"
): Promise<string> {
  const priceId = tier === "pro" ? process.env.STRIPE_PRO_PRICE_ID! : process.env.STRIPE_TEAM_PRICE_ID!;

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

export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });
  return session.url;
}
