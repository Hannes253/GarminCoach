import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";

/**
 * Service-role Supabase client. Bypasses RLS entirely - use ONLY in the
 * Strava webhook route handler (app/api/strava/webhook/route.ts).
 *
 * Why this exists despite the app's normal "no service role" rule: a
 * webhook delivery has no user present and no session cookie, so there is
 * no auth.uid() for RLS to check against - a normal anon-key client simply
 * cannot read or write anything here. This client is instantiated only
 * inside that one server-side route, reads SUPABASE_SERVICE_ROLE_KEY (a
 * server-only env var, never NEXT_PUBLIC_*, never sent to the browser), and
 * every query it makes filters explicitly by user_id/athlete_id itself
 * since RLS won't do it. Never import this from client code or from any
 * route that renders on behalf of a signed-in user's own request.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
