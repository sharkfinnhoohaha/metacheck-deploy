import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Admin client bypasses RLS — only use server-side in trusted contexts
let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return _admin;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
