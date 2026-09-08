import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Optional isolated PostgreSQL engine: set SANVIC_PGLITE_MODULE to an installed
// @electric-sql/pglite entrypoint. Never connects to a production database.
test('owner approval transaction, permissions and paid expiry in PostgreSQL', {skip:!process.env.SANVIC_PGLITE_MODULE}, async()=>{
  const {PGlite}=await import(process.env.SANVIC_PGLITE_MODULE);
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table public.places(id text primary key,name text,type text,barangay text,description text,address text,phone text,website text,booking_url text,
      display_latitude double precision,display_longitude double precision,cover_media_id text default '',photo_ids_json jsonb default '[]',status text default 'draft',updated_at bigint);
      create table public.audit_log(id text primary key,action text,entity_type text,entity_id text,summary text,created_at bigint);`);
    await db.exec(await readFile(new URL('../docs/owners-setup.sql',import.meta.url),'utf8'));
    const user='11111111-1111-4111-8111-111111111111';
    await db.query('insert into auth.users(id) values($1)',[user]);
    await db.query("insert into places(id,name,status) values('test','Test location','draft')");
    const submit=async(kind,payload={},baseline={})=>(await db.query(`insert into owner_requests(user_id,place_id,email,kind,payload,baseline) values($1,'test','owner@example.com',$2,$3,$4) returning id`,[user,kind,JSON.stringify(payload),JSON.stringify(baseline)])).rows[0].id;
    const review=(id,decision='approved',fields=null)=>db.query('select review_owner_request($1,$2,$3,$4)',[id,decision,'Verified independently',fields]);
    const claim=await submit('claim');await review(claim);
    assert.equal((await db.query('select active from location_managers')).rows[0].active,true);
    await assert.rejects(()=>review(claim),/already reviewed/);
    assert.equal((await db.query("select status from places where id='test'")).rows[0].status,'draft');
    const changes=await submit('changes',{name:'New name'},{name:'Test location'});
    await review(changes,'approved',['name']);
    assert.equal((await db.query("select name from places where id='test'")).rows[0].name,'New name');
    const stale=await submit('changes',{name:'Overwrite'},{name:'Test location'});
    await assert.rejects(()=>review(stale,'approved',['name']),/Profile changed/);
    await review(stale,'rejected');
    const pay=await submit('payment',{amount:300,currency:'PHP',reference:'GCASH-123456'});await review(pay);
    const expiry=(await db.query("select pro_until,status from places where id='test'")).rows[0];
    assert.ok(new Date(expiry.pro_until)>new Date());assert.equal(expiry.status,'draft');
    await assert.rejects(()=>review(pay),/already reviewed/);
    await assert.rejects(()=>submit('payment',{amount:300,currency:'PHP',reference:'GCASH-123456'}),/duplicate key/);
    const bad=await submit('payment',{amount:1,currency:'PHP',reference:'GCASH-999999'});await assert.rejects(()=>review(bad),/amount mismatch/);
    await db.exec('set role authenticated');
    await assert.rejects(()=>db.query('select * from owner_requests'),/permission denied/);
    await assert.rejects(()=>review(bad),/permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select public from storage.buckets where id='owner-private'")).rows[0].public,false);
  } finally {await db.close();}
});
