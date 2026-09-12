import { json, seedDefaults } from "@/lib/admin-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;

export async function GET() {
  try {
    const db = supabaseAdmin();
    const [siteSeed, onboardingSeed] = await Promise.all([
      db.from("site_content").select("key").limit(1).maybeSingle(),
      db.from("content_items").select("id").eq("kind", "onboarding").limit(1).maybeSingle(),
    ]);
    if (!siteSeed.data || !onboardingSeed.data) await seedDefaults();

    const [content, items, places, media, joins, travelerUploads] = await Promise.all([
      db.from("site_content").select("key, published_value").order("sort_order"),
      db.from("content_items").select("kind, data_json").eq("status", "published").order("kind").order("sort_order"),
      db.from("places").select("*").eq("status", "published").order("featured", { ascending: false }).order("sort_order").order("name"),
      db.from("media").select("id, filename, content_type, size_bytes, caption, alt_text, status, created_at").eq("status", "active").order("created_at", { ascending: false }),
      db.from("opportunity_joins").select("opportunity_id, travelers(nickname)").order("joined_at"),
      db.from("traveler_uploads").select("id,opportunity_id,caption,created_at,travelers(nickname)").eq("status", "published").eq("completed", true).eq("removed", false).order("created_at", { ascending: false }),
    ]);
    for (const r of [content, items, places, media, joins, travelerUploads]) if (r.error) return json({ error: r.error.message }, 500);

    const copy = Object.fromEntries((content.data ?? []).map((r: Row) => [String(r.key), String(r.published_value)]));
    const byKind = (kind: string) => (items.data ?? []).filter((r: Row) => r.kind === kind).map((r: Row) => r.data_json);
    const publicPlaces = (places.data ?? []).map((r: Row) => ({ id:r.id,name:r.name,type:r.type,barangay:r.barangay,googleMapsUrl:r.google_maps_url,googlePlaceId:r.google_place_id,sourceLatitude:r.source_latitude,sourceLongitude:r.source_longitude,displayLatitude:r.display_latitude,displayLongitude:r.display_longitude,address:r.address,phone:r.phone,website:r.website,description:r.description,bookingUrl:r.booking_url,coverMediaId:r.cover_media_id,photoIds:r.photo_ids_json,menuIds:r.menu_media_ids_json,discoverSections:r.discover_sections_json,rooms:Array.isArray(r.rooms_json)?r.rooms_json:[],links:Array.isArray(r.links_json)?r.links_json:[],status:r.status,featured:Boolean(r.featured),verified:Boolean(r.verified),sortOrder:r.sort_order }));
    const publicMedia = (media.data ?? []).map((r: Row) => ({ id:r.id,filename:r.filename,contentType:r.content_type,sizeBytes:r.size_bytes,caption:r.caption,altText:r.alt_text,status:r.status,createdAt:r.created_at,url:`/api/media/${r.id}`,downloadUrl:`/api/media/${r.id}?download=1` }));

    // Live participation is the source of truth; CMS seed counts are not added.
    const joinsByOpportunity = new Map<string, string[]>();
    for (const row of (joins.data ?? []) as { opportunity_id: string; travelers: { nickname: string } | { nickname: string }[] | null }[]) {
      const nickname = Array.isArray(row.travelers) ? row.travelers[0]?.nickname : row.travelers?.nickname;
      if (!nickname) continue;
      const list = joinsByOpportunity.get(row.opportunity_id) ?? [];
      list.push(nickname);
      joinsByOpportunity.set(row.opportunity_id, list);
    }
    const opportunities = (byKind("opportunity") as Row[]).map((o: Row) => {
      const nicknames = joinsByOpportunity.get(String(o.id)) ?? [];
      return { ...o, count: nicknames.length, joinedNicknames: nicknames };
    });

    // Optional until the additive owner SQL setup is applied. Never expose evidence or receipts.
    const ownerAssets = await db.from('owner_uploads').select('id,place_id,filename,content_type,size_bytes,caption,alt_text,created_at').eq('purpose','gallery').eq('published',true).eq('completed',true).eq('removed',false);
    const liveIds = new Set(publicPlaces.map(p=>p.id));
    for (const asset of ownerAssets.data || []) {
      const parent = publicPlaces.find(p=>p.id===asset.place_id);
      if (!liveIds.has(asset.place_id) || !Array.isArray(parent?.photoIds) || !parent.photoIds.includes(asset.id)) continue;
      publicMedia.push({id:asset.id,filename:asset.filename,contentType:asset.content_type,sizeBytes:asset.size_bytes,caption:asset.caption,altText:asset.alt_text,status:'active',createdAt:new Date(asset.created_at).getTime(),url:`/api/media/${asset.id}`,downloadUrl:`/api/media/${asset.id}?download=1`});
    }
    const enhancedPlaces = publicPlaces.map(p=>{
      const row=(places.data || []).find(r=>r.id===p.id);
      const proActive=Boolean(row?.pro_until && new Date(row.pro_until).getTime()>Date.now());
      return {...p, proActive, featured:p.featured||proActive, ownerDetails:row?.owner_details};
    }).sort((a,b)=>Number(b.featured)-Number(a.featured));

    const travelerExperiences = (travelerUploads.data ?? []).map((row: Row) => {
      const joined = row.travelers as { nickname?: string } | { nickname?: string }[] | null;
      return { id:String(row.id), opportunityId:String(row.opportunity_id), caption:String(row.caption||""), nickname:Array.isArray(joined)?joined[0]?.nickname||"Traveler":joined?.nickname||"Traveler", createdAt:Number(row.created_at), url:`/api/travelers/uploads/${row.id}` };
    });
    return json({ copy, communities: byKind("community"), categories: byKind("category"), opportunities, badges: byKind("badge"), onboarding: byKind("onboarding"), places: enhancedPlaces, media: publicMedia, travelerExperiences });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Content unavailable" }, 500); }
}
