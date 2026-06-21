import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PREFIX = "mc_live_";

/** SHA-256 hex of the plaintext key. We only ever store/compare the hash. */
export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Mint a new key. `plaintext` is shown to the user once; only `hash` is stored. */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = PREFIX + randomBytes(32).toString("base64url");
  return { plaintext, hash: hashKey(plaintext), prefix: PREFIX + "…" + plaintext.slice(-4) };
}

// PostgREST "table not in schema cache" / Postgres "undefined_table" — 006 not applied.
export class ApiKeyTableMissing extends Error {}

/**
 * Resolve a request's `Authorization: Bearer <key>` to the owning clerk_id, or
 * null when the key is absent / malformed / unknown / revoked / expired. Throws
 * ApiKeyTableMissing if the migration isn't applied (caller → 503), and rethrows
 * other DB errors (caller → 503) — never silently treats an outage as "no key".
 */
export async function authenticateApiKey(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const key = match?.[1]?.trim();
  // Reject before hashing if it isn't even shaped like one of our keys.
  if (!key || !key.startsWith(PREFIX)) return null;

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("clerk_id, expires_at")
    .eq("key_hash", hashKey(key))
    .is("revoked_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no matching row → invalid key
    if (error.code === "42P01" || error.code === "PGRST205") throw new ApiKeyTableMissing();
    throw error;
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  // Fire-and-forget last_used_at touch — never block or fail the request on it.
  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", hashKey(key))
    .then(({ error: e }) => { if (e) console.error("api_keys last_used_at update failed:", e); });

  return data.clerk_id;
}
