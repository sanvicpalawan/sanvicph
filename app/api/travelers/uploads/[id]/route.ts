import { cleanText, requireAdmin } from "@/lib/admin-server";
import { supabaseAdmin, TRAVELER_EXPERIENCE_BUCKET } from "@/lib/supabase-admin";
import { getTraveler } from "@/lib/traveler-server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = cleanText((await params).id, 120);
  const db = supabaseAdmin();
  const { data: upload } = await db.from("traveler_uploads").select("traveler_id,object_key,filename,content_type,status,completed,removed").eq("id", id).maybeSingle();
  if (!upload || upload.removed || !upload.completed) return new Response("Not found", { status: 404 });
  const traveler = await getTraveler(request);
  const allowed = upload.status === "published" || traveler?.id === upload.traveler_id || await requireAdmin(request);
  if (!allowed) return new Response("Not found", { status: 404 });
  const { data, error } = await db.storage.from(TRAVELER_EXPERIENCE_BUCKET).download(upload.object_key);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(data, { headers: { "Content-Type": upload.content_type, "Cache-Control": upload.status === "published" ? "public, max-age=86400" : "private, no-store" } });
}
