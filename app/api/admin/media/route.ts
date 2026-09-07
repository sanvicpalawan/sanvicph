import { audit, cleanText, json, requireAdmin } from "@/lib/admin-server";
import { supabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose an image or video." }, 400);
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return json({ error: "Only image and video files are accepted." }, 400);
    if (file.size > 80 * 1024 * 1024) return json({ error: "Files must be 80 MB or smaller." }, 413);
    const id = crypto.randomUUID();
    const extension = file.name.includes(".") ? file.name.split(".").pop()!.replace(/[^a-z0-9]/gi, "").toLowerCase() : "bin";
    const objectKey = `media/${id}.${extension}`;
    const now = Date.now();
    const db = supabaseAdmin();

    const { error: uploadError } = await db.storage.from(MEDIA_BUCKET).upload(objectKey, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return json({ error: uploadError.message }, 500);

    const { error: insertError } = await db.from("media").insert({
      id, object_key: objectKey, filename: cleanText(file.name, 240), content_type: file.type,
      size_bytes: file.size, caption: "", alt_text: "", status: "active", created_at: now,
    });
    if (insertError) { await db.storage.from(MEDIA_BUCKET).remove([objectKey]); return json({ error: insertError.message }, 500); }
    await audit("upload", "media", id, `Uploaded ${cleanText(file.name, 180)}`);

    return json({ media: { id, filename: file.name, contentType: file.type, sizeBytes: file.size, caption: "", altText: "", status: "active", createdAt: now, url: `/api/media/${id}`, downloadUrl: `/api/media/${id}?download=1` } }, 201);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Upload failed." }, 500); }
}
