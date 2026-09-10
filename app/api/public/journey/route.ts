import { json } from "@/lib/admin-server";
import { getTraveler } from "@/lib/traveler-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const traveler = await getTraveler(request);
  if (!traveler) return json({ traveler: null, joined: [], visited: [] });

  const db = supabaseAdmin();
  const [joins, visits] = await Promise.all([
    db.from("opportunity_joins").select("opportunity_id").eq("traveler_id", traveler.id),
    db.from("community_visits").select("community_id").eq("traveler_id", traveler.id),
  ]);
  return json({
    traveler,
    joined: (joins.data ?? []).map((r) => r.opportunity_id as string),
    visited: (visits.data ?? []).map((r) => r.community_id as string),
  });
}
