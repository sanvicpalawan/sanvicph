-- Run once in the SANVIC project's Supabase SQL Editor.
-- Additive: retains all existing places, media, imported drafts and admin sessions.
--
-- Until this runs, the public site and admin UI work as before. The moment you save a
-- location that has rooms, the admin shows a message pointing to this file.
-- After it runs, the seeded BAIA room ("Double Room with Patio") appears on its next
-- admin load and on the published BAIA page.
begin;
alter table public.places add column if not exists rooms_json jsonb;
commit;
