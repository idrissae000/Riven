import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, serviceRoleKey } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS. Server only — used for the shared market
 * cache and for encrypted Warframe Market session tokens, never for reads that
 * should be scoped to a user without an explicit user_id filter.
 */
export function createAdminClient() {
  const env = publicSupabaseEnv();
  const key = serviceRoleKey();
  if (!env || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL not configured");
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
