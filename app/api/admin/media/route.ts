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

export async function DELETE(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    const { id } = await request.json() as { id?: string };
    const safeId = cleanText(id, 120);
    if (!safeId) return json({ error: "Media id is required." }, 400);

    const db = supabaseAdmin();
    const { data: asset, error: findError } = await db
      .from("media")
      .select("object_key, filename")
      .eq("id", safeId)
      .limit(1)
      .maybeSingle();
    if (findError) return json({ error: findError.message }, 500);
    if (!asset) return json({ error: "Media file not found." }, 404);

    const [{ data: places, error: placesError }, { data: items, error: itemsError }] = await Promise.all([
      db.from("places").select("id, cover_media_id, photo_ids_json"),
      db.from("content_items").select("id, data_json"),
    ]);
    if (placesError || itemsError) return json({ error: placesError?.message || itemsError?.message }, 500);

    for (const place of places ?? []) {
      const photoIds = Array.isArray(place.photo_ids_json) ? place.photo_ids_json.filter((photoId: unknown) => photoId !== safeId) : [];
      if (place.cover_media_id === safeId || photoIds.length !== (Array.isArray(place.photo_ids_json) ? place.photo_ids_json.length : 0)) {
        const { error } = await db.from("places").update({
          cover_media_id: place.cover_media_id === safeId ? "" : place.cover_media_id,
          photo_ids_json: photoIds,
          updated_at: Date.now(),
        }).eq("id", place.id);
        if (error) return json({ error: error.message }, 500);
      }
    }

    for (const item of items ?? []) {
      const value = item.data_json && typeof item.data_json === "object" ? { ...item.data_json as Record<string, unknown> } : {};
      const ids = Array.isArray(value.mediaIds) ? value.mediaIds : [];
      const nextIds = ids.filter((mediaId) => mediaId !== safeId);
      if (nextIds.length !== ids.length) {
        value.mediaIds = nextIds;
        const { error } = await db.from("content_items").update({ data_json: value, updated_at: Date.now() }).eq("id", item.id);
        if (error) return json({ error: error.message }, 500);
      }
    }

    const { error: storageError } = await db.storage.from(MEDIA_BUCKET).remove([String(asset.object_key)]);
    if (storageError) return json({ error: storageError.message }, 500);
    const { error: deleteError } = await db.from("media").delete().eq("id", safeId);
    if (deleteError) return json({ error: deleteError.message }, 500);
    await audit("delete", "media", safeId, `Permanently deleted ${cleanText(asset.filename, 180)}`);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Delete failed." }, 500);
  }
}
