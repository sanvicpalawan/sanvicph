-- Run once in the SANVIC project's Supabase SQL Editor, before enabling /owners.
-- Additive: retains all existing places, media, imported drafts and admin sessions.
begin;
alter table public.places add column if not exists owner_details jsonb not null default '{"hours":"","amenities":"","services":"","offers":"","social":"","closure":"open"}';
alter table public.places add column if not exists pro_until timestamptz;

create table if not exists public.location_managers (
  place_id text not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true, created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index if not exists location_managers_user_idx on public.location_managers(user_id, active);
create table if not exists public.owner_uploads (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  object_key text not null unique, filename text not null, content_type text not null,
  size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 83886080),
  purpose text not null check(purpose in ('gallery','evidence','receipt')),
  completed boolean not null default false, published boolean not null default false,
  removed boolean not null default false, caption text not null default '', alt_text text not null default '',
  created_at timestamptz not null default now(), check(not published or purpose = 'gallery')
);
create index if not exists owner_uploads_user_idx on public.owner_uploads(user_id, place_id);
create table if not exists public.owner_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade, email text not null,
  kind text not null check(kind in ('claim','changes','payment')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','more_info')),
  payload jsonb not null default '{}', baseline jsonb not null default '{}', evidence_ids uuid[] not null default '{}',
  review_note text not null default '', created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index if not exists owner_one_pending on public.owner_requests(user_id,place_id,kind) where status='pending';
create unique index if not exists owner_unique_payment_reference on public.owner_requests(lower(payload->>'reference')) where kind='payment' and status in ('pending','approved');
create index if not exists owner_requests_queue_idx on public.owner_requests(status,created_at desc);
create index if not exists owner_requests_place_idx on public.owner_requests(place_id);
create index if not exists owner_requests_user_idx on public.owner_requests(user_id,created_at desc);
alter table public.location_managers enable row level security;
alter table public.owner_uploads enable row level security;
alter table public.owner_requests enable row level security;
-- All record access goes through same-origin server APIs with validated identity.
revoke all on public.location_managers, public.owner_uploads, public.owner_requests from anon, authenticated;
grant all on public.location_managers, public.owner_uploads, public.owner_requests to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('owner-private','owner-private',false,83886080,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- One transaction: serialize reviews, prevent double payment activation, and detect stale edits.
create or replace function public.review_owner_request(request_id uuid, decision text, note text, selected_fields text[] default null)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.owner_requests%rowtype; p public.places%rowtype; k text; changes jsonb := '{}';
  allowed text[] := array['name','type','barangay','description','address','phone','website','booking_url','display_latitude','display_longitude','cover_media_id','photo_ids_json','owner_details'];
  asset record; expiry timestamptz;
begin
  if decision not in ('approved','rejected','more_info') then raise exception 'Invalid review decision'; end if;
  select * into r from public.owner_requests where id=request_id for update;
  if not found or r.status <> 'pending' then raise exception 'Request already reviewed or missing'; end if;
  select * into p from public.places where id=r.place_id for update;
  if not found then raise exception 'Location no longer exists'; end if;
  if decision='approved' then
    if r.kind='claim' then
      if exists(select 1 from public.location_managers where place_id=r.place_id and active and user_id<>r.user_id) then
        raise exception 'Location already has a manager. Resolve ownership before approving another claim';
      end if;
      insert into public.location_managers(place_id,user_id) values(r.place_id,r.user_id)
      on conflict(place_id,user_id) do update set active=true;
    else
      if not exists(select 1 from public.location_managers where place_id=r.place_id and user_id=r.user_id and active) then
        raise exception 'Owner access has been revoked';
      end if;
      if r.kind='payment' then
        if (r.payload->>'amount')::numeric <> 300 or r.payload->>'currency' <> 'PHP' then raise exception 'Payment amount mismatch'; end if;
        expiry := greatest(coalesce(p.pro_until,now()),now()) + interval '1 month';
        update public.places set pro_until=expiry,updated_at=(extract(epoch from clock_timestamp())*1000)::bigint where id=p.id;
      elsif r.kind='changes' then
        if selected_fields is null or cardinality(selected_fields)=0 then raise exception 'Select fields to approve'; end if;
        foreach k in array selected_fields loop
          if not k=any(allowed) or not r.payload ? k then raise exception 'Invalid field'; end if;
          if (to_jsonb(p)->k) is distinct from (r.baseline->k) then raise exception 'Profile changed since submission. Reject and ask owner to reload'; end if;
          changes := changes || jsonb_build_object(k,r.payload->k);
        end loop;
        p := jsonb_populate_record(p,changes);
        if p.cover_media_id<>'' and not coalesce(p.photo_ids_json ? p.cover_media_id,false) then raise exception 'Approve cover and gallery together'; end if;
        for asset in select * from public.owner_uploads where id::text in (select jsonb_array_elements_text(p.photo_ids_json)) loop
          if asset.place_id<>p.id or not asset.completed or asset.removed or asset.purpose<>'gallery' then raise exception 'Invalid gallery media'; end if;
        end loop;
        update public.places set name=p.name,type=p.type,barangay=p.barangay,description=p.description,address=p.address,
          phone=p.phone,website=p.website,booking_url=p.booking_url,display_latitude=p.display_latitude,display_longitude=p.display_longitude,
          cover_media_id=p.cover_media_id,photo_ids_json=p.photo_ids_json,owner_details=p.owner_details,
          updated_at=(extract(epoch from clock_timestamp())*1000)::bigint where id=p.id;
        update public.owner_uploads set published=(id::text in (select jsonb_array_elements_text(p.photo_ids_json)))
          where place_id=p.id and purpose='gallery';
        -- Deliberately never set places.status: only admin's Publish to Explore controls it.
      end if;
    end if;
  end if;
  update public.owner_requests set status=decision,review_note=left(note,3000),reviewed_at=now() where id=request_id;
  insert into public.audit_log(id,action,entity_type,entity_id,summary,created_at)
    values(gen_random_uuid()::text,decision,'owner_request',request_id::text,r.kind||' for '||p.name||': '||left(note,500),(extract(epoch from clock_timestamp())*1000)::bigint);
end $$;
revoke all on function public.review_owner_request(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.review_owner_request(uuid,text,text,text[]) to service_role;
commit;

-- Verify these three entries show RLS enabled after execution.
select tablename, rowsecurity from pg_tables where schemaname='public'
and tablename in ('location_managers','owner_uploads','owner_requests');
