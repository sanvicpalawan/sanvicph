import { z } from 'zod';
import { json } from '@/lib/admin-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ownerUser, requireManager, ownerError, sameOrigin } from '@/lib/owner-server';
import { OWNER_BUCKET, PRO_PRICE, profileSchema, profileOf } from '@/lib/owner-types';

export async function GET(request: Request) {
  try {
    const user = await ownerUser(request); const db = supabaseAdmin();
    const [memberships, requests, uploads, directory] = await Promise.all([
      db.from('location_managers').select('place_id, places(*)').eq('user_id', user.id).eq('active', true),
      db.from('owner_requests').select('*, places(name, barangay)').eq('user_id', user.id).order('created_at', {ascending:false}).limit(100),
      db.from('owner_uploads').select('*').eq('user_id', user.id).eq('completed', true).eq('removed', false).order('created_at'),
      db.from('places').select('id, name, barangay, type, display_latitude, display_longitude').eq('status', 'published').order('name').limit(1000),
    ]);
    for (const result of [memberships, requests, uploads, directory]) if (result.error) throw result.error;
    const media = await Promise.all((uploads.data || []).map(async asset => {
      const { data, error } = await db.storage.from(OWNER_BUCKET).createSignedUrl(asset.object_key, 900);
      if (error) throw error;
      return { ...asset, url: data.signedUrl };
    }));
    const managed = (memberships.data || []).flatMap(m=>Array.isArray(m.places)?m.places:[m.places]).filter(Boolean);
    const legacyIds = [...new Set(managed.flatMap(p=>[p.cover_media_id,...(p.photo_ids_json||[])]).filter(Boolean))];
    if(legacyIds.length){
      const {data:old,error:oldError}=await db.from('media').select('id,filename,content_type,caption,alt_text').in('id',legacyIds).eq('status','active');if(oldError)throw oldError;
      for(const a of old||[]) media.push({...a,place_id:managed.find(p=>(p.photo_ids_json||[]).includes(a.id))?.id,purpose:'gallery',completed:true,published:true,url:`/api/media/${a.id}`});
    }
    return json({ email: user.email, places: (memberships.data || []).map(m => m.places), requests: requests.data, media, directory: directory.data });
  } catch (error) { return ownerError(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request); const user = await ownerUser(request); const db = supabaseAdmin();
    const input = z.object({kind: z.enum(['claim','changes','payment']), placeId: z.string().min(1).max(120), payload: z.record(z.unknown()), evidenceIds: z.array(z.string().uuid()).max(5).default([]), baseline: z.record(z.unknown()).optional()}).parse(await request.json());
    const { data: place, error } = await db.from('places').select('*').eq('id', input.placeId).neq('status','archived').single();
    if (error || !place) throw new Error('Location not found.');
    let payload: Record<string, unknown>;
    if (input.kind === 'claim') {
      if (place.status !== 'published') throw new Error('This location is not available to claim. Contact SANVIC.');
      payload = z.object({name:z.string().trim().min(2).max(180), phone:z.string().trim().min(5).max(80), role:z.enum(['Owner','Authorized manager']), method:z.enum(['Business contact callback','Business document','On-site verification']), details:z.string().trim().min(15).max(3000), confirmed:z.literal(true)}).strict().parse(input.payload);
      if (payload.method !== 'Business contact callback' && !input.evidenceIds.length) throw new Error('Attach verification evidence.');
      // Claiming an account never grants edit permissions; only admin review does.
    } else {
      await requireManager(user.id, input.placeId);
      if (input.kind === 'payment') {
        payload = {...z.object({reference:z.string().trim().regex(/^[A-Za-z0-9-]{6,80}$/, 'Enter the transaction reference'), method:z.enum(['GCash','Direct contact']), note:z.string().trim().max(2000)}).strict().parse(input.payload), amount: PRO_PRICE, currency:'PHP', months:1};
        if (payload.method === 'GCash' && !input.evidenceIds.length) throw new Error('Attach the GCash receipt.');
      } else {
        payload = profileSchema.parse(input.payload);
        if (!input.baseline) throw new Error('Reload this profile before submitting.');
        const ids = (payload.photo_ids_json as string[]);
        const existing = new Set([place.cover_media_id, ...(place.photo_ids_json || [])]);
        const newIds = ids.filter(id => !existing.has(id));
        if (newIds.length) {
          const {data: assets, error: assetError} = await db.from('owner_uploads').select('id, content_type').in('id',newIds).eq('user_id',user.id).eq('place_id',input.placeId).eq('purpose','gallery').eq('completed',true).eq('removed',false);
          if (assetError) throw assetError;
          if (assets?.length !== newIds.length) throw new Error('Use only media uploaded for this location.');
          if (assets.some(a => a.id === payload.cover_media_id && !a.content_type.startsWith('image/'))) throw new Error('Choose a photo for the cover.');
        }
      }
    }
    if (input.evidenceIds.length) {
      const {data: evidence,error: e} = await db.from('owner_uploads').select('id').in('id', input.evidenceIds).eq('user_id',user.id).eq('place_id',input.placeId).eq('purpose',input.kind === 'payment' ? 'receipt' : 'evidence').eq('completed',true).eq('removed',false);
      if(e) throw e; if(evidence?.length !== input.evidenceIds.length) throw new Error('Invalid or incomplete evidence upload.');
    }
    const {error: insertError} = await db.from('owner_requests').insert({place_id: input.placeId, user_id:user.id, email:user.email, kind:input.kind, payload, baseline:input.kind === 'changes' ? profileOf(input.baseline!) : {}, evidence_ids:input.evidenceIds, status:'pending'});
    if(insertError) { if(insertError.code === '23505') throw new Error('A request is already pending, or this payment reference has already been used.'); throw insertError; }
    return json({ok:true, message:'Submitted for admin review. The live profile is unchanged.'},201);
  } catch(error) { return ownerError(error); }
}
