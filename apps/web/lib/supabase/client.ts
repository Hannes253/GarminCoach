import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types.generated";

/**
 * Browser-side Supabase client. Used directly from client components,
 * including the FIT/CSV import pipeline, which upserts normalized
 * activities straight from the browser — RLS enforces `user_id = auth.uid()`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
