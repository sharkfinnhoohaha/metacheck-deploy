import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyWebhookSignature, PAYPAL_PLAN_TO_TIER } from "@/lib/paypal";

type PayPalWebhookEvent = {
  event_type: string;
  resource?: { id?: string; custom_id?: string; plan_id?: string };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {
    "paypal-auth-algo": req.headers.get("paypal-auth-algo") ?? "",
    "paypal-cert-url": req.headers.get("paypal-cert-url") ?? "",
    "paypal-transmission-id": req.headers.get("paypal-transmission-id") ?? "",
    "paypal-transmission-sig": req.headers.get("paypal-transmission-sig") ?? "",
    "paypal-transmission-time": req.headers.get("paypal-transmission-time") ?? "",
  };

  const valid = await verifyWebhookSignature(headers, rawBody).catch(() => false);
  if (!valid) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resource = event.resource ?? {};
  const subscriptionId = resource.id;
  const clerkId = resource.custom_id;
  const planId = resource.plan_id;

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED": {
        const tier = (planId && PAYPAL_PLAN_TO_TIER[planId]) || "pro";
        if (clerkId) {
          await supabaseAdmin
            .from("users")
            .update({ tier, paypal_subscription_id: subscriptionId })
            .eq("clerk_id", clerkId);
        } else if (subscriptionId) {
          await supabaseAdmin
            .from("users")
            .update({ tier })
            .eq("paypal_subscription_id", subscriptionId);
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        if (subscriptionId) {
          await supabaseAdmin
            .from("users")
            .update({ tier: "free", paypal_subscription_id: null })
            .eq("paypal_subscription_id", subscriptionId);
        } else if (clerkId) {
          await supabaseAdmin
            .from("users")
            .update({ tier: "free", paypal_subscription_id: null })
            .eq("clerk_id", clerkId);
        }
        break;
      }
    }
  } catch (err) {
    console.error("PayPal webhook handler error:", err);
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
