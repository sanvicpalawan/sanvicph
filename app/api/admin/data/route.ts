import { audit, cleanText, json, requireAdmin, seedDefaults } from "@/lib/admin-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
const contentRow = (r: Row) => ({ key: r.key, section: r.section, label: r.label, draftValue: r.draft_value, publishedValue: r.published_value, sortOrder: r.sort_order, updatedAt: r.updated_at });
const itemRow = (r: Row) => ({ id: r.id, kind: r.kind, slug: r.slug, title: r.title, data: r.data_json, status: r.status, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });
const mediaRow = (r: Row) => ({ id: r.id, filename: r.filename, contentType: r.content_type, sizeBytes: r.size_bytes, caption: r.caption, altText: r.alt_text, status: r.status, createdAt: r.created_at, url: `/api/media/${r.id}`, downloadUrl: `/api/media/${r.id}?download=1` });
const placeRow = (r: Row) => ({ id: r.id, name: r.name, type: r.type, barangay: r.barangay, googleMapsUrl: r.google_maps_url, googlePlaceId: r.google_place_id, sourceLatitude: r.source_latitude, sourceLongitude: r.source_longitude, displayLatitude: r.display_latitude, displayLongitude: r.display_longitude, address: r.address, phone: r.phone, website: r.website, description: r.description, bookingUrl: r.booking_url, coverMediaId: r.cover_media_id, photoIds: r.photo_ids_json, status: r.status, featured: Boolean(r.featured), verified: Boolean(r.verified), sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });

const statusRank = (status: unknown) => (status === "published" ? 0 : status === "draft" ? 1 : 2);

export async function GET(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    await seedDefaults();
    const db = supabaseAdmin();

    const [content, items, places, media, log] = await Promise.all([
      db.from("site_content").select("*").order("section").order("sort_order").order("key"),
      db.from("content_items").select("*").order("kind").order("sort_order").order("title"),
      db.from("places").select("*").order("sort_order").order("name"),
      db.from("media").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    for (const r of [content, items, places, media, log]) if (r.error) return json({ error: r.error.message }, 500);

    const sortedPlaces = [...(places.data ?? [])] as Row[];
    sortedPlaces.sort((a, b) => statusRank(a.status) - statusRank(b.status));

    return json({
      content: (content.data ?? []).map(contentRow),
      items: (items.data ?? []).map(itemRow),
      places: sortedPlaces.map(placeRow),
      media: (media.data ?? []).map(mediaRow),
      audit: log.data ?? [],
    });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to load admin data." }, 500); }
}

export async function PUT(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    const payload = await request.json() as { resource?: string; record?: Record<string, unknown>; publish?: boolean };
    const record = payload.record || {}; const now = Date.now();
    const db = supabaseAdmin();

    if (payload.resource === "content") {
      const key = cleanText(record.key, 120); const section = cleanText(record.section, 80); const label = cleanText(record.label, 120); const value = cleanText(record.draftValue);
      if (!key || !section || !label) return json({ error: "Content key, section, and label are required." }, 400);
      const published = payload.publish ? value : cleanText(record.publishedValue);
      const { error } = await db.from("site_content").upsert({
        key, section, label, draft_value: value, published_value: published, sort_order: Number(record.sortOrder) || 0, updated_at: now,
      }, { onConflict: "key" });
      if (error) return json({ error: error.message }, 500);
      await audit(payload.publish ? "publish" : "save", "content", key, `${payload.publish ? "Published" : "Saved"} ${label}`);
      return json({ ok: true });
    }

    if (payload.resource === "item") {
      const id = cleanText(record.id, 120) || crypto.randomUUID(); const kind = cleanText(record.kind, 40); const slug = cleanText(record.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-"); const title = cleanText(record.title, 160);
      if (!kind || !slug || !title) return json({ error: "Type, slug, and title are required." }, 400);
      const status = payload.publish ? "published" : cleanText(record.status, 20) || "draft";
      const dataObject = record.data && typeof record.data === "object" ? { ...(record.data as Record<string, unknown>) } : {};
      dataObject.id = slug; if (kind === "community" || kind === "badge") dataObject.name = title; else dataObject.title = title;
      const { error } = await db.from("content_items").upsert({
        id, kind, slug, title, data_json: dataObject, status, sort_order: Number(record.sortOrder) || 0, created_at: now, updated_at: now,
      }, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      await audit(payload.publish ? "publish" : "save", kind, id, `${payload.publish ? "Published" : "Saved"} ${title}`);
      return json({ ok: true, id });
    }

    if (payload.resource === "place") {
      const id = cleanText(record.id, 120) || crypto.randomUUID(); const name = cleanText(record.name, 180); const barangay = cleanText(record.barangay, 80); const type = cleanText(record.type, 80);
      const lat = Number(record.displayLatitude); const lng = Number(record.displayLongitude);
      if (!name || !barangay || !type || !Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "Name, type, barangay, latitude, and longitude are required." }, 400);
      const status = payload.publish ? "published" : cleanText(record.status, 20) || "draft";
      const { error } = await db.from("places").upsert({
        id, name, type, barangay,
        google_maps_url: cleanText(record.googleMapsUrl, 2000), google_place_id: cleanText(record.googlePlaceId, 300),
        source_latitude: record.sourceLatitude == null ? null : Number(record.sourceLatitude),
        source_longitude: record.sourceLongitude == null ? null : Number(record.sourceLongitude),
        display_latitude: lat, display_longitude: lng,
        address: cleanText(record.address, 1000), phone: cleanText(record.phone, 80), website: cleanText(record.website, 1000),
        description: cleanText(record.description), booking_url: cleanText(record.bookingUrl, 1000), cover_media_id: cleanText(record.coverMediaId, 120),
        photo_ids_json: Array.isArray(record.photoIds) ? record.photoIds : [],
        status, featured: Boolean(record.featured), verified: Boolean(record.verified), sort_order: Number(record.sortOrder) || 0,
        created_at: now, updated_at: now,
      }, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      await audit(payload.publish ? "publish" : "save", "place", id, `${payload.publish ? "Published" : "Saved"} ${name} in ${barangay}`);
      return json({ ok: true, id });
    }

    if (payload.resource === "media") {
      const id = cleanText(record.id, 120); if (!id) return json({ error: "Media id is required." }, 400);
      const { error } = await db.from("media").update({ caption: cleanText(record.caption, 500), alt_text: cleanText(record.altText, 500) }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      await audit("edit", "media", id, `Updated ${cleanText(record.filename, 160) || "media"}`);
      return json({ ok: true });
    }

    return json({ error: "Unknown resource." }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to save." }, 500); }
}

export async function DELETE(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    const { resource, id } = await request.json() as { resource?: string; id?: string };
    const safeId = cleanText(id, 120); if (!safeId) return json({ error: "Id is required." }, 400);
    const table = resource === "place" ? "places" : resource === "item" ? "content_items" : resource === "media" ? "media" : "";
    if (!table) return json({ error: "Unknown resource." }, 400);
    const { error } = await supabaseAdmin().from(table).update({ status: "archived" }).eq("id", safeId);
    if (error) return json({ error: error.message }, 500);
    await audit("archive", resource || "record", safeId, "Archived from admin");
    return json({ ok: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to archive." }, 500); }
}
