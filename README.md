# SANVIC 2027

Responsive destination app for San Vicente, Palawan, based on the supplied SANVIC 2027 design.

## Architecture
- `components/sanvic-app.tsx`: app navigation, community sheets, editorial views, opportunities, local journey.
- `components/sanvic-map.tsx`: projected satellite map, geographic outlines, clickable markers, pan and zoom.
- `lib/sanvic-data.ts`: reusable communities, editorial categories, and sample opportunities.
- `app/globals.css`: responsive navy and bronze visual system.

## Data boundaries
Traveler counts, avatars, and gatherings are clearly labeled sample content. Join actions save sample plans on the current device. They do not book or contact people. Community visits are recorded only when the user chooses Mark as visited. Live inventory, availability, messaging, profiles, and multi-user participation require a backend and actual community data.

Map boundaries reuse the Philippine Statistics Authority PSGC December 2023 dataset from https://github.com/faeldon/philippines-json-maps (MIT). Markers identify approximate community centers, not navigation destinations. Satellite imagery: Esri, Vantor, Earthstar Geographics and the GIS User Community. Imagery attribution is visible on the map.

Real San Vicente photography is used for the home and coast. Activity photography may represent other locations and is labeled representative. All photo sources and licenses are in `public/photo-credits.json`.

## PWA
Includes a web manifest, application icons, and a service worker that caches public imagery/fonts only. Private page HTML and authentication are network-only. Full offline page navigation is not provided.

## Backend
Postgres + Storage via Supabase (see `lib/supabase-admin.ts`). Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, and `ADMIN_PIN` as environment variables. Deployed on Vercel — `npm run build` runs a standard `next build`.
