-- SANVIC Travelers + Journey (additive, safe to re-run)
create extension if not exists pgcrypto;

create table if not exists public.travelers (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 24),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.traveler_sessions (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  token_hash text not null unique,
  expires_at bigint not null
);

create table if not exists public.opportunity_joins (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  joined_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (opportunity_id, traveler_id)
);

create table if not exists public.community_visits (
  id uuid primary key default gen_random_uuid(),
  community_id text not null,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  visited_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (community_id, traveler_id)
);

create table if not exists public.traveler_uploads (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  opportunity_id text not null,
  object_key text not null unique,
  filename text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  caption text not null default '' check (char_length(caption) <= 500),
  completed boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  removed boolean not null default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists traveler_sessions_traveler_idx on public.traveler_sessions(traveler_id);
create index if not exists opportunity_joins_opportunity_idx on public.opportunity_joins(opportunity_id);
create index if not exists opportunity_joins_traveler_idx on public.opportunity_joins(traveler_id);
create index if not exists community_visits_community_idx on public.community_visits(community_id);
create index if not exists community_visits_traveler_idx on public.community_visits(traveler_id);
create index if not exists traveler_uploads_owner_idx on public.traveler_uploads(traveler_id, created_at desc);
create index if not exists traveler_uploads_public_idx on public.traveler_uploads(opportunity_id, status) where completed and not removed;

alter table public.travelers enable row level security;
alter table public.traveler_sessions enable row level security;
alter table public.opportunity_joins enable row level security;
alter table public.community_visits enable row level security;
alter table public.traveler_uploads enable row level security;

revoke all on public.travelers, public.traveler_sessions, public.opportunity_joins, public.community_visits, public.traveler_uploads from anon, authenticated;
grant all on public.travelers, public.traveler_sessions, public.opportunity_joins, public.community_visits, public.traveler_uploads to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('traveler-experiences', 'traveler-experiences', false, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
