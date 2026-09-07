import { supabaseAdmin } from "./supabase-admin";
import { baiaSeed, copySeed, itemSeed } from "./admin-seed";

export const SESSION_COOKIE = "sanvic_admin";

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function requireAdmin(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return false;
  const tokenHash = await sha256(token);
  const { data } = await supabaseAdmin()
    .from("admin_sessions")
    .select("id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", Date.now())
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function seedDefaults() {
  const db = supabaseAdmin();
  const now = Date.now();

  const contentRows = copySeed.map(([key, section, label, value], index) => ({
    key, section, label, draft_value: value, published_value: value, sort_order: index, updated_at: now,
  }));
  // ignoreDuplicates so existing edits made in the admin UI are never clobbered by reseeding.
  await db.from("site_content").upsert(contentRows, { onConflict: "key", ignoreDuplicates: true });

  const itemRows = itemSeed.map((item) => ({
    id: item.id, kind: item.kind, slug: item.slug, title: item.title,
    data_json: item.data, status: "published", sort_order: item.sortOrder,
    created_at: now, updated_at: now,
  }));
  await db.from("content_items").upsert(itemRows, { onConflict: "id", ignoreDuplicates: true });

  await db.from("places").upsert([{
    id: baiaSeed.id, name: baiaSeed.name, type: baiaSeed.type, barangay: baiaSeed.barangay,
    google_maps_url: baiaSeed.googleMapsUrl, google_place_id: baiaSeed.googlePlaceId,
    source_latitude: baiaSeed.sourceLatitude, source_longitude: baiaSeed.sourceLongitude,
    display_latitude: baiaSeed.displayLatitude, display_longitude: baiaSeed.displayLongitude,
    address: baiaSeed.address, phone: baiaSeed.phone, website: baiaSeed.website,
    description: baiaSeed.description, booking_url: baiaSeed.bookingUrl,
    cover_media_id: baiaSeed.coverMediaId, photo_ids_json: baiaSeed.photoIds,
    status: baiaSeed.status, featured: true, verified: true, sort_order: 0,
    created_at: now, updated_at: now,
  }], { onConflict: "id", ignoreDuplicates: true });
}

export async function audit(action: string, entityType: string, entityId: string, summary: string) {
  await supabaseAdmin().from("audit_log").insert({
    id: crypto.randomUUID(), action, entity_type: entityType, entity_id: entityId, summary, created_at: Date.now(),
  });
}

export function cleanText(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
