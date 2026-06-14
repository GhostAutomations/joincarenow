import { createClient } from "@supabase/supabase-js";

/** Server-only Supabase client using the service-role key. Bypasses RLS —
 *  ONLY use after performing your own permission checks. Never import this
 *  into client components. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
