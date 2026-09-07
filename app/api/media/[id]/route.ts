import { supabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = supabaseAdmin();
    const { data: row } = await db
      .from("media")
      .select("object_key, filename, content_type, status")
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (!row || row.status === "archived") return new Response("Not found", { status: 404 });

    const { data: file, error } = await db.storage.from(MEDIA_BUCKET).download(row.object_key as string);
    if (error || !file) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", row.content_type as string);
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers.set("Content-Disposition", `attachment; filename="${(row.filename as string).replace(/["\r\n]/g, "_")}"`);
    }
    return new Response(file, { headers });
  } catch { return new Response("Media unavailable", { status: 500 }); }
}
