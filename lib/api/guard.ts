import { authenticateApiKey, ApiKeyTableMissing } from "@/lib/apikey";
import { getUserTier } from "@/lib/auth";

/** API error body, matching the app's { data, error } convention. */
function err(error: string, status: number): Response {
  return Response.json({ data: null, error }, { status });
}

export type GuardResult = { ok: true; clerkId: string } | { ok: false; response: Response };

/**
 * Gate a public /api/v1 request to a valid Label (tier==='team') API key.
 * Returns the owning clerkId on success, or a ready-to-return Response on
 * failure (401 invalid key, 403 not Label, 503 if the table isn't migrated).
 */
export async function requireLabelApiKey(req: Request): Promise<GuardResult> {
  let clerkId: string | null;
  try {
    clerkId = await authenticateApiKey(req);
  } catch (e) {
    if (e instanceof ApiKeyTableMissing) return { ok: false, response: err("API is being set up. Try again shortly.", 503) };
    console.error("API key auth error:", e);
    return { ok: false, response: err("Authentication temporarily unavailable.", 503) };
  }
  if (!clerkId) return { ok: false, response: err("Invalid or missing API key. Pass 'Authorization: Bearer mc_live_…'.", 401) };

  const tier = await getUserTier(clerkId);
  if (tier !== "team") {
    return { ok: false, response: err("The API is available on the Label plan. Upgrade at /settings.", 403) };
  }
  return { ok: true, clerkId };
}
