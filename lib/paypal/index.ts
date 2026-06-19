// PayPal billing — additive alternative to Stripe. Server-side only.
// Uses the REST API directly (the official Node SDK does not cover the
// Subscriptions/Billing-Plans APIs). Tier is still driven by the webhook,
// exactly like the Stripe integration, and written to users.tier.

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// Maps a PayPal Billing Plan ID -> app tier (mirrors PRICE_TO_TIER for Stripe).
// Includes monthly and annual plans; both intervals resolve to the same tier.
export const PAYPAL_PLAN_TO_TIER: Record<string, "pro" | "team"> = {
  [process.env.PAYPAL_PRO_PLAN_ID ?? ""]: "pro",
  [process.env.PAYPAL_TEAM_PLAN_ID ?? ""]: "team",
  [process.env.PAYPAL_PRO_ANNUAL_PLAN_ID ?? ""]: "pro",
  [process.env.PAYPAL_TEAM_ANNUAL_PLAN_ID ?? ""]: "team",
};
delete PAYPAL_PLAN_TO_TIER[""]; // drop the collapsed key from any unset env vars

export type PayPalInterval = "month" | "year";

let _token: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_token && _token.expiresAt > Date.now() + 60_000) return _token.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials are not configured");

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal token error: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return _token.value;
}

async function pp(path: string, init: { method?: string; body?: string } = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${PAYPAL_API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body,
  });
}

/** Creates a subscription and returns the PayPal approval URL to redirect the buyer to. */
export async function createSubscription(
  clerkId: string,
  email: string,
  tier: "pro" | "team",
  interval: PayPalInterval = "month"
): Promise<string> {
  const planId =
    interval === "year"
      ? tier === "pro"
        ? process.env.PAYPAL_PRO_ANNUAL_PLAN_ID
        : process.env.PAYPAL_TEAM_ANNUAL_PLAN_ID
      : tier === "pro"
        ? process.env.PAYPAL_PRO_PLAN_ID
        : process.env.PAYPAL_TEAM_PLAN_ID;
  if (!planId) throw new Error(`PayPal plan ID for tier "${tier}" (${interval}) is not configured`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const res = await pp("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      custom_id: clerkId, // echoed back on webhooks so we can map to the user
      subscriber: email ? { email_address: email } : undefined,
      application_context: {
        brand_name: "MetaCheck",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${appUrl}/settings?paypal=success`,
        cancel_url: `${appUrl}/settings?paypal=cancelled`,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`PayPal create subscription failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { links?: { rel: string; href: string }[] };
  const approve = json.links?.find((l) => l.rel === "approve");
  if (!approve) throw new Error("PayPal did not return an approval link");
  return approve.href;
}

/** Cancels an active subscription. PayPal returns 204 on success. */
export async function cancelSubscription(
  subscriptionId: string,
  reason = "Customer requested cancellation"
): Promise<void> {
  const res = await pp(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`PayPal cancel failed: ${res.status} ${await res.text()}`);
  }
}

/** Verifies a webhook via PayPal's verify-webhook-signature postback API. */
export async function verifyWebhookSignature(
  headers: Record<string, string>,
  rawBody: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const res = await pp("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { verification_status?: string };
  return json.verification_status === "SUCCESS";
}
