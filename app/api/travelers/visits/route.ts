import { json, cleanText } from "@/lib/admin-server";
import { requireTraveler, travelerError, assertSameOrigin } from "@/lib/traveler-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const traveler = await requireTraveler(request);
    const { communityId } = (await request.json()) as { communityId?: string };
    const id = cleanText(communityId, 120);
    if (!id) return json({ error: "Missing community." }, 400);
    const { data: item } = await supabaseAdmin().from("content_items").select("id").eq("kind", "community").eq("slug", id).eq("status", "published").maybeSingle();
    if (!item) return json({ error: "This community is no longer available." }, 404);
    const { error } = await supabaseAdmin()
      .from("community_visits")
      .upsert({ community_id: id, traveler_id: traveler.id, visited_at: Date.now() }, { onConflict: "community_id,traveler_id" });
    if (error) throw error;
    return json({ visited: true });
  } catch (error) {
    return travelerError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const traveler = await requireTraveler(request);
    const { communityId } = (await request.json()) as { communityId?: string };
    const id = cleanText(communityId, 120);
    if (!id) return json({ error: "Missing community." }, 400);
    const { data: item } = await supabaseAdmin().from("content_items").select("id").eq("kind", "community").eq("slug", id).eq("status", "published").maybeSingle();
    if (!item) return json({ error: "This community is no longer available." }, 404);
    const { error } = await supabaseAdmin()
      .from("community_visits")
      .delete()
      .eq("community_id", id)
      .eq("traveler_id", traveler.id);
    if (error) throw error;
    return json({ visited: false });
  } catch (error) {
    return travelerError(error);
  }
}
