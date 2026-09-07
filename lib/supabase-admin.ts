import { createClient } from "@supabase/supabase-js";

// Server-side only. Uses the secret key, which bypasses Row Level Security —
// never import this file from client components, and never expose
// SUPABASE_SECRET_KEY to the browser (no NEXT_PUBLIC_ prefix).
let client: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
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
