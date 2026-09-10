import { json } from "@/lib/admin-server";
import { getTraveler } from "@/lib/traveler-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const traveler = await getTraveler(request);
  if (!traveler) return json({ traveler: null, joined: [], visited: [], uploads: [] });

  const db = supabaseAdmin();
  const [joins, visits, uploads] = await Promise.all([
    db.from("opportunity_joins").select("opportunity_id").eq("traveler_id", traveler.id),
    db.from("community_visits").select("community_id").eq("traveler_id", traveler.id),
    db.from("traveler_uploads").select("id,opportunity_id,filename,caption,status,created_at").eq("traveler_id", traveler.id).eq("completed", true).eq("removed", false).order("created_at", { ascending: false }),
  ]);
  return json({
    traveler,
    joined: (joins.data ?? []).map((r) => r.opportunity_id as string),
    visited: (visits.data ?? []).map((r) => r.community_id as string),
    uploads: (uploads.data ?? []).map((r) => ({ id:r.id, opportunityId:r.opportunity_id, filename:r.filename, caption:r.caption, status:r.status, createdAt:r.created_at, url:`/api/travelers/uploads/${r.id}` })),
  });
}
