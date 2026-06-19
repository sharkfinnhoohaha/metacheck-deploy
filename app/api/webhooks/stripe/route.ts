import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/auth";
import { markWebhookProcessed, unmarkWebhook } from "@/lib/webhooks";

// Maps every configured Stripe price (monthly + annual) → app tier.
const PRICE_TO_TIER: Record<string, "pro" | "team"> = {
  [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro",
  [process.env.STRIPE_TEAM_PRICE_ID ?? ""]: "team",
  [process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? ""]: "pro",
  [process.env.STRIPE_TEAM_ANNUAL_PRICE_ID ?? ""]: "team",
};
delete PRICE_TO_TIER[""]; // guard against unset env vars collapsing to a single "" key

function tierForPrice(priceId: string): "pro" | "team" | null {
  return PRICE_TO_TIER[priceId] ?? null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    return Response.json({ error: message }, { status: 400 });
  }

  // Idempotency: skip a replayed/duplicate delivery so credit grants happen once.
  if (!(await markWebhookProcessed("stripe", event.id))) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.metadata?.clerk_id;
        if (!clerkId) break;

        // One-time per-release credit purchase (mode: "payment").
        if (session.mode === "payment" && session.metadata?.kind === "release_credit") {
          const qty = parseInt(session.metadata?.credits ?? "1", 10) || 1;
          await addCredits(clerkId, qty);
          break;
        }

        // Subscription checkout → set tier from the purchased price.
        const subscriptionId = session.subscription as string;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id ?? "";
        const tier = tierForPrice(priceId);
        if (!tier) {
          console.error("Stripe webhook: unmapped price on checkout, skipping tier set", { priceId, subscriptionId });
          break;
        }

        await supabaseAdmin.from("users").upsert(
          {
            clerk_id: clerkId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            tier,
          },
          { onConflict: "clerk_id" }
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id ?? "";
        const tier = tierForPrice(priceId);
        if (!tier) {
          console.error("Stripe webhook: unmapped price on update, skipping", { priceId });
          break;
        }
        {
          const { data } = await supabaseAdmin
            .from("users")
            .update({ tier, stripe_subscription_id: subscription.id })
            .eq("stripe_customer_id", subscription.customer as string)
            .select("clerk_id");
          if (!data?.length) console.error("Stripe webhook: no user matched customer on update", { customer: subscription.customer });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const { data } = await supabaseAdmin
          .from("users")
          .update({ tier: "free", stripe_subscription_id: null })
          .eq("stripe_customer_id", subscription.customer as string)
          .select("clerk_id");
        if (!data?.length) console.error("Stripe webhook: no user matched customer on delete", { customer: subscription.customer });
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    // Let Stripe retry: undo the idempotency mark so the retry isn't skipped.
    await unmarkWebhook(event.id);
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
