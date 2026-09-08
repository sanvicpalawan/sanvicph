import { z } from 'zod';
import { json, requireAdmin, audit } from '@/lib/admin-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ownerError, sameOrigin, requireManager } from '@/lib/owner-server';
import { OWNER_BUCKET } from '@/lib/owner-types';
export async function GET(request:Request) {
  try {
    if(!await requireAdmin(request)) return json({error:'Unauthorized'},401);
    const db=supabaseAdmin();
    const [requests,managers,media,places]=await Promise.all([
      db.from('owner_requests').select('*, places(name,barangay)').order('created_at',{ascending:false}).limit(1000),
      db.from('location_managers').select('*, places(name,barangay)').order('created_at',{ascending:false}),
      db.from('owner_uploads').select('*').eq('completed',true).eq('removed',false).limit(1000),
      db.from('places').select('id,name,pro_until').not('pro_until','is',null),
    ]);
    for(const r of [requests,managers,media,places]) if(r.error) throw r.error;
    const assets=await Promise.all((media.data||[]).map(async a=>{
      const {data,error}=await db.storage.from(OWNER_BUCKET).createSignedUrl(a.object_key,900); if(error) throw error;
      return {...a,url:data.signedUrl};
    }));
    return json({requests:requests.data,managers:managers.data,media:assets,pro:places.data});
  }catch(error){return ownerError(error);}
}
export async function POST(request:Request) {
  try {
    sameOrigin(request); if(!await requireAdmin(request)) return json({error:'Unauthorized'},401);
    const body=await request.json();
    if(body.directPayment===true){
      const v=z.object({placeId:z.string().min(1).max(120),userId:z.string().uuid(),reference:z.string().trim().regex(/^[A-Za-z0-9-]{6,80}$/),note:z.string().trim().min(3).max(2000)}).parse(body);
      await requireManager(v.userId,v.placeId);
      const db=supabaseAdmin();const {data,error}=await db.auth.admin.getUserById(v.userId);if(error||!data.user.email)throw new Error('Owner account not found.');
      const {error:insertError}=await db.from('owner_requests').insert({kind:'payment',place_id:v.placeId,user_id:v.userId,email:data.user.email,status:'pending',payload:{method:'Direct contact',reference:v.reference,note:v.note,amount:300,currency:'PHP',months:1}});if(insertError)throw insertError;
      return json({ok:true});
    }
    const {id,decision,note,fields}=z.object({id:z.string().uuid(),decision:z.enum(['approved','rejected','more_info']),note:z.string().trim().min(3).max(3000),fields:z.array(z.string()).optional()}).parse(body);
    const {error}=await supabaseAdmin().rpc('review_owner_request',{request_id:id,decision,note,selected_fields:fields||null}); if(error) throw error;
    return json({ok:true});
  }catch(error){return ownerError(error);}
}
export async function PATCH(request:Request) {
  try {
    sameOrigin(request); if(!await requireAdmin(request)) return json({error:'Unauthorized'},401);
    const input=z.object({placeId:z.string().min(1).max(120),userId:z.string().uuid().optional(),action:z.enum(['revoke','add_manager','stop_pro']),email:z.string().email().optional()}).parse(await request.json());
    const db=supabaseAdmin();
    if(input.action==='stop_pro') {
      const {error}=await db.from('places').update({pro_until:new Date().toISOString(),updated_at:Date.now()}).eq('id',input.placeId);if(error)throw error;
    } else if(input.action==='revoke') {
      if(!input.userId)throw new Error('Choose an owner.');
      const {error}=await db.from('location_managers').update({active:false}).eq('place_id',input.placeId).eq('user_id',input.userId);if(error)throw error;
    } else {
      if(!input.email)throw new Error('Enter the manager email.');
      // Resolve only previously verified claimants, not arbitrary client user IDs.
      const {data,error}=await db.from('owner_requests').select('user_id').eq('email',input.email.toLowerCase()).eq('place_id',input.placeId).eq('kind','claim').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(error)throw error;if(!data)throw new Error('Ask this manager to sign in and submit a claim first.');
      const {error:writeError}=await db.from('location_managers').upsert({place_id:input.placeId,user_id:data.user_id,active:true});if(writeError)throw writeError;
    }
    await audit(input.action,'place',input.placeId,`Admin ${input.action}`);return json({ok:true});
  }catch(error){return ownerError(error);}
}
