import { json, cleanText } from "@/lib/admin-server";
import { requireTraveler, travelerError } from "@/lib/traveler-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const traveler = await requireTraveler(request);
    const { opportunityId } = (await request.json()) as { opportunityId?: string };
    const id = cleanText(opportunityId, 120);
    if (!id) return json({ error: "Missing opportunity." }, 400);
    const { error } = await supabaseAdmin()
      .from("opportunity_joins")
      .upsert({ opportunity_id: id, traveler_id: traveler.id, joined_at: Date.now() }, { onConflict: "opportunity_id,traveler_id" });
    if (error) throw error;
    return json({ joined: true });
  } catch (error) {
    return travelerError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const traveler = await requireTraveler(request);
    const { opportunityId } = (await request.json()) as { opportunityId?: string };
    const id = cleanText(opportunityId, 120);
    if (!id) return json({ error: "Missing opportunity." }, 400);
    const { error } = await supabaseAdmin()
      .from("opportunity_joins")
      .delete()
      .eq("opportunity_id", id)
      .eq("traveler_id", traveler.id);
    if (error) throw error;
    return json({ joined: false });
  } catch (error) {
    return travelerError(error);
  }
}
