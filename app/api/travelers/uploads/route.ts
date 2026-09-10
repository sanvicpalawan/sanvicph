import { cleanText, json } from "@/lib/admin-server";
import { supabaseAdmin, TRAVELER_EXPERIENCE_BUCKET } from "@/lib/supabase-admin";
import { assertSameOrigin, requireTraveler, travelerError } from "@/lib/traveler-server";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

async function publishedOpportunity(id: string) {
  const { data } = await supabaseAdmin().from("content_items").select("id").eq("kind", "opportunity").eq("slug", id).eq("status", "published").maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const traveler = await requireTraveler(request);
    const body = await request.json() as { opportunityId?: string; filename?: string; contentType?: string; sizeBytes?: number };
    const opportunityId = cleanText(body.opportunityId, 120);
    const filename = cleanText(body.filename, 180) || "experience.jpg";
    const contentType = cleanText(body.contentType, 80);
    const sizeBytes = Number(body.sizeBytes);
    if (!opportunityId || !await publishedOpportunity(opportunityId)) return json({ error: "This opportunity is no longer available." }, 404);
    if (!allowed.has(contentType) || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) return json({ error: "Choose a JPG, PNG, or WebP image up to 12 MB." }, 400);
    const dayAgo = Date.now() - 86400000;
    const { count } = await supabaseAdmin().from("traveler_uploads").select("id", { count: "exact", head: true }).eq("traveler_id", traveler.id).gte("created_at", dayAgo);
    if ((count ?? 0) >= 20) return json({ error: "You have reached today’s 20-photo limit." }, 429);
    const id = crypto.randomUUID();
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const objectKey = `${traveler.id}/${id}.${extension}`;
    const db = supabaseAdmin();
    const { error: insertError } = await db.from("traveler_uploads").insert({ id, traveler_id: traveler.id, opportunity_id: opportunityId, object_key: objectKey, filename, content_type: contentType, size_bytes: sizeBytes, created_at: Date.now() });
    if (insertError) throw insertError;
    const { data, error } = await db.storage.from(TRAVELER_EXPERIENCE_BUCKET).createSignedUploadUrl(objectKey);
    if (error || !data) { await db.from("traveler_uploads").delete().eq("id", id); throw error || new Error("Unable to prepare upload."); }
    return json({ id, path: data.path, token: data.token });
  } catch (error) { return travelerError(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const traveler = await requireTraveler(request);
    const body = await request.json() as { id?: string; caption?: string };
    const id = cleanText(body.id, 120);
    const caption = cleanText(body.caption, 500);
    const db = supabaseAdmin();
    const { data: upload } = await db.from("traveler_uploads").select("object_key").eq("id", id).eq("traveler_id", traveler.id).eq("removed", false).maybeSingle();
    if (!upload) return json({ error: "Upload not found." }, 404);
    const { data: files } = await db.storage.from(TRAVELER_EXPERIENCE_BUCKET).list(upload.object_key.split("/")[0], { search: upload.object_key.split("/")[1], limit: 1 });
    if (!files?.length) return json({ error: "The image upload did not finish." }, 400);
    const { error } = await db.from("traveler_uploads").update({ caption, completed: true, status: "pending" }).eq("id", id).eq("traveler_id", traveler.id);
    if (error) throw error;
    return json({ ok: true, status: "pending" });
  } catch (error) { return travelerError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const traveler = await requireTraveler(request);
    const id = cleanText((await request.json()).id, 120);
    const db = supabaseAdmin();
    const { data: upload } = await db.from("traveler_uploads").select("object_key,status").eq("id", id).eq("traveler_id", traveler.id).maybeSingle();
    if (!upload) return json({ error: "Upload not found." }, 404);
    await db.storage.from(TRAVELER_EXPERIENCE_BUCKET).remove([upload.object_key]);
    const { error } = await db.from("traveler_uploads").delete().eq("id", id).eq("traveler_id", traveler.id);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) { return travelerError(error); }
}
