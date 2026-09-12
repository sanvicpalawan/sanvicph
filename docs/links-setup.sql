-- Run once in the SANVIC project's Supabase SQL Editor.
-- Additive: retains all existing places, media, imported drafts and admin sessions.
--
-- Until this runs, the public site and admin UI work as before. The moment you save
-- a location that has links, the admin shows a message pointing to this file.
-- After it runs, "Links" rows added in the admin appear as tappable pills near the
-- top of the published location page (phone/website/booking URL keep working too).
begin;
alter table public.places add column if not exists links_json jsonb;
commit;
