-- SANVIC application schema — Neon (Lakebase) Postgres.
--
-- This is the single source of truth for the database. It replaces:
--   * the base tables that existed only inside the Lovable/Supabase instance
--     (never committed to git), reconstructed from the application code
--   * docs/links-setup.sql        (places.links_json)
--   * docs/rooms-setup.sql        (places.rooms_json)
--   * docs/owners-setup.sql       (owner tables + review function)
--   * docs/travelers-journey-setup.sql (traveler tables)
--
-- Adaptations from the Supabase versions:
--   * No auth.users / storage.buckets references: Supabase Auth and Storage are
--     gone. owner_* tables keep user_id but defer the FK until the new auth
--     provider is connected (tracked in docs/owner-portal.md).
--   * No anon / authenticated / service_role grants and no RLS: the browser
--     never reaches Postgres. All access goes through Next.js API routes using
--     DATABASE_URL, so authorization is enforced in the API layer.
--   * Timestamps keep the app's existing conventions: bigint epoch-ms where the
--     app writes Date.now(), timestamptz where the original SQL used now().
--
-- Idempotent: safe to re-run. Apply with: node scripts/apply-schema.mjs

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- CMS: editable site copy (key/value with draft + published values)
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
  key             text primary key,
  section         text not null default '',
  label           text not null default '',
  draft_value     text not null default '',
  published_value text not null default '',
  sort_order      integer not null default 0,
  updated_at      bigint not null default 0
);

-- ---------------------------------------------------------------------------
-- CMS: structured items (communities, categories, opportunities, badges,
-- onboarding options) — one polymorphic table, discriminated by kind
-- ---------------------------------------------------------------------------
create table if not exists public.content_items (
  id         text primary key,
  kind       text not null,
  slug       text not null,
  title      text not null,
  data_json  jsonb not null default '{}'::jsonb,
  status     text not null default 'draft',
  sort_order integer not null default 0,
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);
create index if not exists content_items_kind_slug_idx
  on public.content_items (kind, slug, status);

-- ---------------------------------------------------------------------------
-- Locations (the map: communities seed this, KMZ imports and admin edit it)
-- ---------------------------------------------------------------------------
create table if not exists public.places (
  id                     text primary key,
  name                   text not null default '',
  type                   text not null default '',
  barangay               text not null default '',
  google_maps_url        text not null default '',
  google_place_id        text not null default '',
  source_latitude        double precision,
  source_longitude       double precision,
  display_latitude       double precision not null default 0,
  display_longitude      double precision not null default 0,
  address                text not null default '',
  phone                  text not null default '',
  website                text not null default '',
  description            text not null default '',
  booking_url            text not null default '',
  cover_media_id         text not null default '',
  photo_ids_json         jsonb not null default '[]'::jsonb,
  menu_media_ids_json    jsonb not null default '[]'::jsonb,
  discover_sections_json jsonb not null default '[]'::jsonb,
  rooms_json             jsonb,                        -- docs/rooms-setup.sql
  links_json             jsonb,                        -- docs/links-setup.sql
  owner_details          jsonb not null default '{"hours":"","amenities":"","services":"","offers":"","social":"","closure":"open"}'::jsonb,
  pro_until              timestamptz,
  status                 text not null default 'draft', -- draft | published | archived
  featured               boolean not null default false,
  verified               boolean not null default false,
  sort_order             integer not null default 0,
  created_at             bigint not null default 0,
  updated_at             bigint not null default 0
);
create index if not exists places_status_idx on public.places (status, sort_order);
create index if not exists places_pro_idx on public.places (pro_until) where pro_until is not null;

-- ---------------------------------------------------------------------------
-- Media library (admin uploads; object_key points into the object store)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id           text primary key,
  object_key   text not null,
  filename     text not null,
  content_type text not null,
  size_bytes   bigint not null default 0,
  caption      text not null default '',
  alt_text     text not null default '',
  status       text not null default 'active',
  created_at   bigint not null default 0
);

-- ---------------------------------------------------------------------------
-- Admin sessions (PIN sign-in; token hashes only, 8h expiry)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_sessions (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at bigint not null,
  created_at bigint not null default 0
);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Audit log (append-only activity trail shown in admin)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          text primary key,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  summary     text not null default '',
  created_at  bigint not null default 0
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Travelers (anonymous device identities + their journey activity)
-- Ported from docs/travelers-journey-setup.sql (RLS/grants/storage removed).
-- ---------------------------------------------------------------------------
create table if not exists public.travelers (
  id         uuid primary key default gen_random_uuid(),
  nickname   text not null check (char_length(nickname) between 1 and 24),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.traveler_sessions (
  id          uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  bigint not null
);

create table if not exists public.opportunity_joins (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id text not null,
  traveler_id    uuid not null references public.travelers(id) on delete cascade,
  joined_at      bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (opportunity_id, traveler_id)
);

create table if not exists public.community_visits (
  id           uuid primary key default gen_random_uuid(),
  community_id text not null,
  traveler_id  uuid not null references public.travelers(id) on delete cascade,
  visited_at   bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (community_id, traveler_id)
);

create table if not exists public.traveler_uploads (
  id            uuid primary key default gen_random_uuid(),
  traveler_id   uuid not null references public.travelers(id) on delete cascade,
  opportunity_id text not null,
  object_key    text not null unique,
  filename      text not null,
  content_type  text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  caption       text not null default '' check (char_length(caption) <= 500),
  completed     boolean not null default false,
  status        text not null default 'pending' check (status in ('pending','published','rejected')),
  removed       boolean not null default false,
  created_at    bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists traveler_sessions_traveler_idx on public.traveler_sessions(traveler_id);
create index if not exists opportunity_joins_opportunity_idx on public.opportunity_joins(opportunity_id);
create index if not exists opportunity_joins_traveler_idx on public.opportunity_joins(traveler_id);
create index if not exists community_visits_community_idx on public.community_visits(community_id);
create index if not exists community_visits_traveler_idx on public.community_visits(traveler_id);
create index if not exists traveler_uploads_owner_idx on public.traveler_uploads(traveler_id, created_at desc);
create index if not exists traveler_uploads_public_idx on public.traveler_uploads(opportunity_id, status) where completed and not removed;

-- ---------------------------------------------------------------------------
-- Business owners (claim / manage locations)
-- Ported from docs/owners-setup.sql. user_id has no FK yet: the Supabase
-- auth.users table is gone and the replacement auth provider is not connected.
-- ---------------------------------------------------------------------------
create table if not exists public.location_managers (
  place_id   text not null references public.places(id) on delete cascade,
  user_id    uuid not null,               -- TODO: FK once auth users exist
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index if not exists location_managers_user_idx on public.location_managers(user_id, active);

create table if not exists public.owner_uploads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,             -- TODO: FK once auth users exist
  place_id     text not null references public.places(id) on delete cascade,
  object_key   text not null unique,
  filename     text not null,
  content_type text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 83886080),
  purpose      text not null check (purpose in ('gallery','evidence','receipt')),
  completed    boolean not null default false,
  published    boolean not null default false,
  removed      boolean not null default false,
  caption      text not null default '',
  alt_text     text not null default '',
  created_at   timestamptz not null default now(),
  check (not published or purpose = 'gallery')
);
create index if not exists owner_uploads_user_idx on public.owner_uploads(user_id, place_id);

create table if not exists public.owner_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,             -- TODO: FK once auth users exist
  place_id     text not null references public.places(id) on delete cascade,
  email        text not null,
  kind         text not null check (kind in ('claim','changes','payment')),
  status       text not null default 'pending' check (status in ('pending','approved','rejected','more_info')),
  payload      jsonb not null default '{}'::jsonb,
  baseline     jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  review_note  text not null default '',
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create unique index if not exists owner_one_pending on public.owner_requests(user_id, place_id, kind) where status = 'pending';
create unique index if not exists owner_unique_payment_reference on public.owner_requests(lower(payload->>'reference')) where kind = 'payment' and status in ('pending','approved');
create index if not exists owner_requests_queue_idx on public.owner_requests(status, created_at desc);
create index if not exists owner_requests_place_idx on public.owner_requests(place_id);
create index if not exists owner_requests_user_idx on public.owner_requests(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- review_owner_request(): ported verbatim from docs/owners-setup.sql.
-- One transaction that serializes owner-request review, prevents double
-- payment activation and detects stale edits. Supabase-only role grants
-- (anon/authenticated/service_role) were dropped: the app connects as the
-- database owner from server code only.
-- ---------------------------------------------------------------------------
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
