import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileSchema, nextProExpiry, PRO_PRICE } from '../lib/owner-types.ts';

const profile={name:'BAIA',type:'Accommodation',barangay:'Poblacion',description:'Beachfront lodge',address:'Poblacion',phone:'',website:'',booking_url:'',display_latitude:10.5311,display_longitude:119.3412,cover_media_id:'',photo_ids_json:[],owner_details:{hours:'',amenities:'',services:'',offers:'',social:'',closure:'open'}};
test('owners cannot smuggle publishing, verification, ownership or paid status into edits',()=>{
  assert.equal(profileSchema.safeParse(profile).success,true);
  for(const key of ['status','featured','verified','pro_until','user_id']) assert.equal(profileSchema.safeParse({...profile,[key]:'approved'}).success,false);
});
test('profile validation restricts coordinates and website protocols',()=>{
  assert.equal(profileSchema.safeParse({...profile,website:'javascript:alert(1)'}).success,false);
  assert.equal(profileSchema.safeParse({...profile,display_latitude:91}).success,false);
  assert.equal(profileSchema.safeParse({...profile,cover_media_id:'not-in-gallery'}).success,false);
});
test('founder payments are 300 pesos and extend a calendar month with month-end clamping',()=>{
  assert.equal(PRO_PRICE,300);
  assert.equal(nextProExpiry(null,new Date('2026-01-31T12:00:00Z')),'2026-02-28T12:00:00.000Z');
  assert.equal(nextProExpiry('2026-10-08T12:00:00Z',new Date('2026-09-08T12:00:00Z')),'2026-11-08T12:00:00.000Z');
});
test('database review is atomic, restricted and does not publish drafts',async()=>{
  const sql=await readFile(new URL('../docs/owners-setup.sql',import.meta.url),'utf8');
  assert.match(sql,/security invoker/i);assert.match(sql,/for update/i);
  assert.match(sql,/revoke all on function.*from public,anon,authenticated/);
  assert.match(sql,/r.status <> 'pending'/);assert.match(sql,/is distinct from/);
  assert.doesNotMatch(sql,/update public\.places set status=/i);
  assert.match(sql,/where kind='payment' and status in \('pending','approved'\)/);
});
