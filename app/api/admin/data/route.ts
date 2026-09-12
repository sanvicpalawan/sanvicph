import { audit, cleanText, json, requireAdmin, seedDefaults } from "@/lib/admin-server";
import { PLACE_LINK_ICON_NAMES } from "@/lib/place-links";
import { supabaseAdmin, TRAVELER_EXPERIENCE_BUCKET } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
const contentRow = (r: Row) => ({ key: r.key, section: r.section, label: r.label, draftValue: r.draft_value, publishedValue: r.published_value, sortOrder: r.sort_order, updatedAt: r.updated_at });
const itemRow = (r: Row) => ({ id: r.id, kind: r.kind, slug: r.slug, title: r.title, data: r.data_json, status: r.status, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });
const mediaRow = (r: Row) => ({ id: r.id, filename: r.filename, contentType: r.content_type, sizeBytes: r.size_bytes, caption: r.caption, altText: r.alt_text, status: r.status, createdAt: r.created_at, url: `/api/media/${r.id}`, downloadUrl: `/api/media/${r.id}?download=1` });
const placeRow = (r: Row) => ({ id: r.id, name: r.name, type: r.type, barangay: r.barangay, googleMapsUrl: r.google_maps_url, googlePlaceId: r.google_place_id, sourceLatitude: r.source_latitude, sourceLongitude: r.source_longitude, displayLatitude: r.display_latitude, displayLongitude: r.display_longitude, address: r.address, phone: r.phone, website: r.website, description: r.description, bookingUrl: r.booking_url, coverMediaId: r.cover_media_id, photoIds: r.photo_ids_json, menuIds: r.menu_media_ids_json, discoverSections: r.discover_sections_json, rooms: Array.isArray(r.rooms_json) ? r.rooms_json : [], links: Array.isArray(r.links_json) ? r.links_json : [], status: r.status, featured: Boolean(r.featured), verified: Boolean(r.verified), sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });

// Rooms are stored as a JSON blob (places.rooms_json). Sanitize before saving so junk from
// the admin UI can never reach the public site. Direct booking URLs are optional per-room
// links (own site, Viber, email or phone) — not third-party marketplaces.
const sanitizeRooms = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((entry) => {
    const room = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const groups = (Array.isArray(room.groups) ? room.groups : []).slice(0, 12).map((entry2) => {
      const group = (entry2 && typeof entry2 === "object" ? entry2 : {}) as Record<string, unknown>;
      const items = (Array.isArray(group.items) ? group.items : []).map((item) => cleanText(String(item), 120)).filter(Boolean).slice(0, 80);
      return { title: cleanText(String(group.title || ""), 80) || "Amenities", items };
    }).filter((group) => group.items.length);
    const rate = Number(room.rateFrom);
    const rawBookingUrl = cleanText(String(room.bookingUrl || ""), 2000);
    const bookingUrl = rawBookingUrl && /^(https:\/\/|tel:|mailto:|viber:)/i.test(rawBookingUrl) ? rawBookingUrl : undefined;
    return {
      id: cleanText(String(room.id || ""), 60) || crypto.randomUUID(),
      name: cleanText(String(room.name || ""), 160),
      units: Number.isFinite(Number(room.units)) && Number(room.units) > 0 ? Math.min(99, Number(room.units)) : undefined,
      size: cleanText(String(room.size || ""), 60) || undefined,
      beds: cleanText(String(room.beds || ""), 120) || undefined,
      description: cleanText(String(room.description || "")) || undefined,
      chips: (Array.isArray(room.chips) ? room.chips : []).map((chip) => cleanText(String(chip), 80)).filter(Boolean).slice(0, 16),
      groups,
      photoIds: (Array.isArray(room.photoIds) ? room.photoIds : []).map((id) => cleanText(String(id), 120)).filter(Boolean).slice(0, 60),
      rateFrom: Number.isFinite(rate) && rate > 0 ? Math.min(100000000, rate) : undefined,
      rateNote: cleanText(String(room.rateNote || ""), 200) || undefined,
      bookingUrl,
    };
  }).filter((room) => room.name);
};

// Links are stored as a JSON blob (places.links_json). Only http(s) URLs and icons from the
// curated Lucide set survive, so nothing from the admin UI can render as markup on the public page.
const sanitizeLinks = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  const hostFor = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "") || url; } catch { return url; } };
  return raw.slice(0, 24).map((entry) => {
    const link = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const url = cleanText(String(link.url || ""), 2000);
    const icon = cleanText(String(link.icon || ""), 60);
    const label = cleanText(String(link.label || ""), 80) || hostFor(url);
    return {
      id: cleanText(String(link.id || ""), 60) || crypto.randomUUID(),
      label,
      url,
      icon: PLACE_LINK_ICON_NAMES.includes(icon) ? icon : undefined,
    };
  }).filter((link) => link.label && /^https?:\/\//i.test(link.url));
};
const travelerUploadRow = (r: Row) => { const t=r.travelers as {nickname?:string}|{nickname?:string}[]|null; return { id:r.id, opportunityId:r.opportunity_id, filename:r.filename, caption:r.caption, status:r.status, createdAt:r.created_at, nickname:Array.isArray(t)?t[0]?.nickname||"Traveler":t?.nickname||"Traveler", url:`/api/travelers/uploads/${r.id}` }; };

const statusRank = (status: unknown) => (status === "published" ? 0 : status === "draft" ? 1 : 2);

export async function GET(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    await seedDefaults();
    const db = supabaseAdmin();

    const [content, items, places, media, log, travelerMedia] = await Promise.all([
      db.from("site_content").select("*").order("section").order("sort_order").order("key"),
      db.from("content_items").select("*").order("kind").order("sort_order").order("title"),
      db.from("places").select("*").order("sort_order").order("name"),
      db.from("media").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("traveler_uploads").select("id,opportunity_id,filename,caption,status,created_at,travelers(nickname)").eq("completed", true).eq("removed", false).order("created_at", { ascending: false }).limit(200),
    ]);
    for (const r of [content, items, places, media, log, travelerMedia]) if (r.error) return json({ error: r.error.message }, 500);

    const sortedPlaces = [...(places.data ?? [])] as Row[];
    sortedPlaces.sort((a, b) => statusRank(a.status) - statusRank(b.status));

    return json({
      content: (content.data ?? []).map(contentRow),
      items: (items.data ?? []).map(itemRow),
      places: sortedPlaces.map(placeRow),
      media: (media.data ?? []).map(mediaRow),
      imports: [],
      audit: log.data ?? [],
      travelerMedia: (travelerMedia.data ?? []).map(travelerUploadRow),
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
      const rooms = sanitizeRooms(record.rooms);
      const links = sanitizeLinks(record.links);
      const placePayload = {
        id, name, type, barangay,
        google_maps_url: cleanText(record.googleMapsUrl, 2000), google_place_id: cleanText(record.googlePlaceId, 300),
        source_latitude: record.sourceLatitude == null ? null : Number(record.sourceLatitude),
        source_longitude: record.sourceLongitude == null ? null : Number(record.sourceLongitude),
        display_latitude: lat, display_longitude: lng,
        address: cleanText(record.address, 1000), phone: cleanText(record.phone, 80), website: cleanText(record.website, 1000),
        description: cleanText(record.description), booking_url: cleanText(record.bookingUrl, 1000), cover_media_id: cleanText(record.coverMediaId, 120),
        photo_ids_json: Array.isArray(record.photoIds) ? record.photoIds : [],
        menu_media_ids_json: Array.isArray(record.menuIds) ? record.menuIds : [],
        discover_sections_json: Array.isArray(record.discoverSections) ? record.discoverSections : [],
        status, featured: Boolean(record.featured), verified: Boolean(record.verified), sort_order: Number(record.sortOrder) || 0,
        created_at: now, updated_at: now,
      };
      // rooms_json is only written when this place has rooms, so saving any other location keeps
      // working on databases where docs/rooms-setup.sql has not run yet. links_json is always
      // written (even empty) so deleting the last link clears it; on databases without the column
      // we retry the save without it so the rest of the edit is never lost.
      const extras: Record<string, unknown> = {};
      if (rooms.length) extras.rooms_json = rooms;
      extras.links_json = links;
      let upsert = await db.from("places").upsert({ ...placePayload, ...extras }, { onConflict: "id" });
      if (upsert.error && !links.length && /links_json/i.test(upsert.error.message)) {
        delete extras.links_json;
        upsert = await db.from("places").upsert({ ...placePayload, ...extras }, { onConflict: "id" });
      }
      if (upsert.error) {
        if (extras.rooms_json && /rooms_json/i.test(upsert.error.message)) return json({ error: "Rooms support is not enabled on the database yet. Paste docs/rooms-setup.sql into the Supabase SQL Editor, run it, then save again." }, 500);
        if (extras.links_json && /links_json/i.test(upsert.error.message)) return json({ error: "Links support is not enabled on the database yet. Paste docs/links-setup.sql into the Supabase SQL Editor, run it, then save again." }, 500);
        return json({ error: upsert.error.message }, 500);
      }
      await audit(payload.publish ? "publish" : "save", "place", id, `${payload.publish ? "Published" : "Saved"} ${name} in ${barangay}`);
      return json({ ok: true, id });
    }

    if (payload.resource === "place_status") {
      const id = cleanText(record.id, 120); const published = record.published === true;
      if (!id) return json({ error: "Location id is required." }, 400);
      const { data: place, error: findError } = await db
        .from("places")
        .select("name, barangay, display_latitude, display_longitude")
        .eq("id", id)
        .neq("status", "archived")
        .limit(1)
        .maybeSingle();
      if (findError) return json({ error: findError.message }, 500);
      if (!place) return json({ error: "Location not found." }, 404);
      if (published && (!cleanText(place.barangay, 80) || place.barangay === "Unassigned" || !Number.isFinite(Number(place.display_latitude)) || !Number.isFinite(Number(place.display_longitude)))) {
        return json({ error: "Confirm the barangay and map marker before publishing." }, 400);
      }
      const status = published ? "published" : "draft";
      const { error } = await db.from("places").update({ status, updated_at: now }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      await audit(published ? "publish" : "unpublish", "place", id, `${published ? "Published" : "Removed"} ${cleanText(place.name, 180)} ${published ? "to" : "from"} Explore`);
      return json({ ok: true, status });
    }

    if (payload.resource === "media") {
      const id = cleanText(record.id, 120); if (!id) return json({ error: "Media id is required." }, 400);
      const { error } = await db.from("media").update({ caption: cleanText(record.caption, 500), alt_text: cleanText(record.altText, 500) }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      await audit("edit", "media", id, `Updated ${cleanText(record.filename, 160) || "media"}`);
      return json({ ok: true });
    }

    if (payload.resource === "traveler_upload") {
      const id = cleanText(record.id, 120); const status = cleanText(record.status, 20); if (!id || !["pending","published","rejected"].includes(status)) return json({ error: "Upload and valid status are required." }, 400);
      const { error } = await db.from("traveler_uploads").update({ caption: cleanText(record.caption, 500), status }).eq("id", id).eq("completed", true).eq("removed", false);
      if (error) return json({ error: error.message }, 500);
      await audit(status === "published" ? "publish" : "moderate", "traveler_upload", id, `${status} traveler experience photo`);
      return json({ ok: true });
    }

    return json({ error: "Unknown resource." }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to save." }, 500); }
}

export async function DELETE(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    const { resource, id, permanent } = await request.json() as { resource?: string; id?: string; permanent?: boolean };
    const safeId = cleanText(id, 120); if (!safeId) return json({ error: "Id is required." }, 400);
    if (resource === "place" && permanent === true) {
      const db = supabaseAdmin();
      const { data: place, error: findError } = await db.from("places").select("name").eq("id", safeId).limit(1).maybeSingle();
      if (findError) return json({ error: findError.message }, 500);
      if (!place) return json({ error: "Location not found." }, 404);
      const { error } = await db.from("places").delete().eq("id", safeId);
      if (error) return json({ error: error.message }, 500);
      await audit("delete", "place", safeId, `Permanently deleted ${cleanText(place.name, 180)}`);
      return json({ ok: true });
    }
    if (resource === "traveler_upload") {
      const db = supabaseAdmin();
      const { data: upload, error: findError } = await db.from("traveler_uploads").select("object_key,filename").eq("id", safeId).maybeSingle();
      if (findError) return json({ error: findError.message }, 500);
      if (!upload) return json({ error: "Traveler upload not found." }, 404);
      await db.storage.from(TRAVELER_EXPERIENCE_BUCKET).remove([upload.object_key]);
      const { error } = await db.from("traveler_uploads").delete().eq("id", safeId);
      if (error) return json({ error: error.message }, 500);
      await audit("delete", "traveler_upload", safeId, `Deleted ${cleanText(upload.filename, 180)}`);
      return json({ ok: true });
    }
    const table = resource === "place" ? "places" : resource === "item" ? "content_items" : resource === "media" ? "media" : "";
    if (!table) return json({ error: "Unknown resource." }, 400);
    const { error } = await supabaseAdmin().from(table).update({ status: "archived" }).eq("id", safeId);
    if (error) return json({ error: error.message }, 500);
    await audit("archive", resource || "record", safeId, "Archived from admin");
    return json({ ok: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to archive." }, 500); }
}
