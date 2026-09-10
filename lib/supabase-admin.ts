import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side only. Uses the secret key, which bypasses Row Level Security —
// never import this file from client components, and never expose
// SUPABASE_SECRET_KEY to the browser (no NEXT_PUBLIC_ prefix).
// Typed loosely (no generated Database schema) since this project doesn't
// use Supabase's generated types — this avoids spurious "never" type errors
// on every insert/upsert/update call.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const MEDIA_BUCKET = "media";
export const TRAVELER_EXPERIENCE_BUCKET = "traveler-experiences";
