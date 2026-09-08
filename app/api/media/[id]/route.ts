import { supabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin";
import { OWNER_BUCKET } from '@/lib/owner-types';

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
    if (!row) {
      const {data:asset}=await db.from('owner_uploads').select('object_key,place_id,filename').eq('id',id).eq('purpose','gallery').eq('published',true).eq('completed',true).eq('removed',false).maybeSingle();
      if(!asset)return new Response('Not found',{status:404});
      const {data:place}=await db.from('places').select('photo_ids_json').eq('id',asset.place_id).eq('status','published').maybeSingle();
      if(!Array.isArray(place?.photo_ids_json)||!place.photo_ids_json.includes(id))return new Response('Not found',{status:404});
      // Short signed redirects let Storage serve byte ranges for video playback.
      const {data:signed,error}=await db.storage.from(OWNER_BUCKET).createSignedUrl(asset.object_key,60,new URL(request.url).searchParams.has('download')?{download:asset.filename}:undefined);
      if(error||!signed)return new Response('Not found',{status:404});
      return new Response(null,{status:307,headers:{Location:signed.signedUrl,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
    }
    if (row.status !== "active") return new Response("Not found", { status: 404 });

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
