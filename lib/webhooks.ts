import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Idempotency guard for at-least-once webhook delivery (Stripe & PayPal can
 * deliver — or be manually replayed — more than once, and signature verification
 * stops forgery, not replay). Inserts the event id; returns:
 *  - true  → first time, the caller should process it.
 *  - false → already processed, the caller should skip (return 200).
 * FAILS OPEN (returns true) when the webhook_events table isn't present yet
 * (migration 004 not applied) so behavior is unchanged until it's run.
 */
export async function markWebhookProcessed(provider: string, eventId: string): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await supabaseAdmin.from("webhook_events").insert({ event_id: eventId, provider });
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false; // unique violation = duplicate
  console.warn("Webhook dedup unavailable, processing without idempotency:", error.message);
  return true;
}

/**
 * Undo a mark when processing failed, so the provider's retry reprocesses the
 * event instead of being skipped as a duplicate.
 */
export async function unmarkWebhook(eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    await supabaseAdmin.from("webhook_events").delete().eq("event_id", eventId);
  } catch (err) {
    console.warn("unmarkWebhook failed:", err);
  }
}
