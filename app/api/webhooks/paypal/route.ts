import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyWebhookSignature, PAYPAL_PLAN_TO_TIER } from "@/lib/paypal";
import { markWebhookProcessed, unmarkWebhook } from "@/lib/webhooks";

type PayPalWebhookEvent = {
  id?: string;
  event_type: string;
  resource?: { id?: string; custom_id?: string; plan_id?: string };
};

// Downgrade a user to free. `clearId` drops the subscription handle (terminal
// cancellation/expiry); a suspension keeps it so the user can still cancel and
// a later reactivation can restore them.
async function downgrade(
  { subscriptionId, clerkId, clearId }: { subscriptionId?: string; clerkId?: string; clearId: boolean }
) {
  const patch = clearId ? { tier: "free", paypal_subscription_id: null } : { tier: "free" };
  if (subscriptionId) {
    await supabaseAdmin.from("users").update(patch).eq("paypal_subscription_id", subscriptionId);
  } else if (clerkId) {
    await supabaseAdmin.from("users").update(patch).eq("clerk_id", clerkId);
  }
}

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

  // Idempotency: skip duplicate/replayed deliveries.
  if (event.id && !(await markWebhookProcessed("paypal", event.id))) {
    return Response.json({ received: true, duplicate: true });
  }

  const resource = event.resource ?? {};
  const subscriptionId = resource.id;
  const clerkId = resource.custom_id;
  const planId = resource.plan_id;

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED": {
        // Only map plans we actually recognize. Defaulting an unmapped plan to
        // "pro" could silently downgrade a Label/team subscriber if a plan ID
        // is mis-set, so skip and surface it for the operator instead.
        const tier = planId ? PAYPAL_PLAN_TO_TIER[planId] : undefined;
        if (!tier) {
          console.error("PayPal webhook: unmapped plan_id, skipping tier update", {
            planId, subscriptionId, type: event.event_type,
          });
          break;
        }
        if (clerkId) {
          await supabaseAdmin
            .from("users")
            .update({ tier, paypal_subscription_id: subscriptionId })
            .eq("clerk_id", clerkId);
        } else if (subscriptionId) {
          // No custom_id on this delivery — try to match by subscription id. That
          // id is only written to a user row by THIS handler, so the first
          // activation (row keyed by clerk_id, no sub-id yet) matches zero rows.
          // Don't mark the event processed: unmark + 503 so PayPal retries once
          // the row carries the sub-id, instead of silently dropping the upgrade.
          const { data: matched, error } = await supabaseAdmin
            .from("users")
            .update({ tier })
            .eq("paypal_subscription_id", subscriptionId)
            .select("clerk_id");
          if (error) throw error;
          if (!matched || matched.length === 0) {
            console.error("PayPal webhook: no user row for subscription id yet — will retry", {
              subscriptionId, type: event.event_type,
            });
            if (event.id) await unmarkWebhook(event.id);
            return Response.json(
              { error: "No matching user for subscription yet; retry later" },
              { status: 503 }
            );
          }
        } else {
          // Un-actionable (no identifiers at all) — let PayPal retry rather than
          // marking it permanently processed.
          console.error("PayPal webhook: no custom_id or subscription id on event", {
            type: event.event_type,
          });
          if (event.id) await unmarkWebhook(event.id);
          return Response.json(
            { error: "Missing subscription identifiers; retry later" },
            { status: 503 }
          );
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        // Terminal — revoke access and drop the subscription handle.
        await downgrade({ subscriptionId, clerkId, clearId: true });
        break;
      }

      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        // Recoverable hold (e.g. failed-payment retry) — revoke paid access but
        // keep the subscription id so the user can still cancel/reactivate.
        await downgrade({ subscriptionId, clerkId, clearId: false });
        break;
      }
    }
  } catch (err) {
    console.error("PayPal webhook handler error:", err);
    if (event.id) await unmarkWebhook(event.id); // let PayPal retry
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
