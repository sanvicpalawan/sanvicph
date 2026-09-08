import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { json } from '@/lib/admin-server';
import { ownerUser, requireManager, ownerError, sameOrigin } from '@/lib/owner-server';
import { OWNER_BUCKET } from '@/lib/owner-types';
const mime = z.enum(['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','application/pdf']);
export async function POST(request: Request) {
  try {
    sameOrigin(request); const user=await ownerUser(request); const db=supabaseAdmin();
    const input=z.object({placeId:z.string().min(1).max(120),purpose:z.enum(['gallery','evidence','receipt']),filename:z.string().min(1).max(240),contentType:mime,size:z.number().int().positive().max(80*1024*1024)}).parse(await request.json());
    if(input.purpose !== 'evidence') await requireManager(user.id,input.placeId);
    else { const {data,error}=await db.from('places').select('id').eq('id',input.placeId).eq('status','published').single(); if(error||!data) throw new Error('Location not found.'); }
    if(input.purpose==='gallery' && input.contentType==='application/pdf') throw new Error('Use images or videos for the gallery.');
    if(input.purpose!=='gallery' && (input.size>10*1024*1024 || input.contentType.startsWith('video/'))) throw new Error('Evidence and receipts: images or PDF, up to 10 MB.');
    const {count,error:quotaError}=await db.from('owner_uploads').select('id',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',new Date(Date.now()-86400000).toISOString());
    if(quotaError) throw quotaError; if((count||0)>=60) throw new Error('Daily upload limit reached. Please try tomorrow.');
    const id=crypto.randomUUID(); const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','application/pdf':'pdf'} as const)[input.contentType];
    const path=`${user.id}/${id}.${ext}`;
    const {error}=await db.from('owner_uploads').insert({id,user_id:user.id,place_id:input.placeId,object_key:path,filename:input.filename,content_type:input.contentType,size_bytes:input.size,purpose:input.purpose}); if(error) throw error;
    const {data,error:signError}=await db.storage.from(OWNER_BUCKET).createSignedUploadUrl(path); if(signError) throw signError;
    return json({id,path,token:data.token,bucket:OWNER_BUCKET});
  } catch(error) {return ownerError(error);}
}
export async function PATCH(request:Request) {
  try {
    sameOrigin(request); const user=await ownerUser(request); const db=supabaseAdmin();
    const {id,caption,altText}=z.object({id:z.string().uuid(),caption:z.string().max(500).default(''),altText:z.string().max(500).default('')}).parse(await request.json());
    const {data:asset,error}=await db.from('owner_uploads').select('*').eq('id',id).eq('user_id',user.id).eq('removed',false).single(); if(error||!asset) throw new Error('Upload not found.');
    if(asset.published) throw new Error('Published captions can only be changed through a new reviewed upload.');
    const [folder,filename]=asset.object_key.split('/');
    const {data:objects,error:listError}=await db.storage.from(OWNER_BUCKET).list(folder,{search:filename}); if(listError) throw listError;
    const file=objects.find(o=>o.name===filename);
    if(!file || Number(file.metadata?.size)!==asset.size_bytes || file.metadata?.mimetype!==asset.content_type) throw new Error('Upload is incomplete or its format does not match. Please upload again.');
    const {error:updateError}=await db.from('owner_uploads').update({completed:true,caption,alt_text:altText}).eq('id',id).eq('user_id',user.id).eq('published',false); if(updateError) throw updateError;
    return json({ok:true});
  }catch(error){return ownerError(error);}
}
export async function DELETE(request:Request) {
  try {
    sameOrigin(request); const user=await ownerUser(request); const db=supabaseAdmin(); const {id}=z.object({id:z.string().uuid()}).parse(await request.json());
    const {data:asset,error}=await db.from('owner_uploads').select('*').eq('id',id).eq('user_id',user.id).single(); if(error||!asset) throw new Error('Upload not found.');
    if(asset.published) throw new Error('Remove this photo from the profile and submit the change for review first.');
    const {data:requests,error:requestError}=await db.from('owner_requests').select('evidence_ids,payload').eq('user_id',user.id).eq('place_id',asset.place_id);
    if(requestError) throw requestError;
    if(requests.some(r=>r.evidence_ids.includes(id)||(r.payload.photo_ids_json||[]).includes(id))) throw new Error('This file is retained as part of a submitted request. Remove it from the next profile revision instead.');
    const {error:updateError}=await db.from('owner_uploads').update({removed:true}).eq('id',id).eq('user_id',user.id).eq('published',false); if(updateError) throw updateError;
    // Soft-delete preserves recoverability; it no longer appears in the owner library.
    return json({ok:true});
  }catch(error){return ownerError(error);}
}
