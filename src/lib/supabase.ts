import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function hasSupabaseConfig() {
  return hasSupabasePublicConfig();
}

export function hasSupabaseAdminConfig() {
  return Boolean(supabaseUrl && supabaseSecretKey);
}

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export function createSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Missing Supabase service role or secret key environment variables.");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
