import { z } from 'zod';

export const OWNER_BUCKET = 'owner-private';
export const PRO_PRICE = 300;
export const CONTACT_EMAIL = 'merqatodigital@proton.me';
// Temporary build-phase switch. Set this to false when individual owner login is restored.
export const OPEN_OWNER_BUILDER_MODE = true;
export const barangays = ['Alimanguan', 'San Isidro', 'Sto. Niño', 'New Agutaya', 'Poblacion', 'Kemdeng', 'Port Barton', 'Caruray', 'Binga', 'New Canipo'] as const;
export const placeTypes = ['Accommodation', 'Cafe', 'Restaurant', 'Island', 'Tour', 'Sightseeing', 'Beach', 'Activity', 'Transport', 'Service', 'Event'] as const;
const text = (max: number) => z.string().trim().max(max);
const url = text(1500).refine(v => !v || /^https?:\/\//i.test(v), 'Use a full https:// address');
export const profileSchema = z.object({
  name: text(180).min(1), type: z.enum(placeTypes), barangay: z.enum(barangays),
  description: text(10000), address: text(1000), phone: text(80), website: url, booking_url: url,
  display_latitude: z.number().min(7.72).max(12.38), display_longitude: z.number().min(117.72).max(120.28),
  cover_media_id: text(120), photo_ids_json: z.array(text(120)).max(40),
  owner_details: z.object({ hours: text(2000), amenities: text(3000), services: text(3000), offers: text(5000), social: text(3000), closure: z.enum(['open', 'temporarily_closed', 'permanently_closed']) }),
}).strict().refine(v => !v.cover_media_id || v.photo_ids_json.includes(v.cover_media_id), 'Cover must be included in the gallery');
export type OwnerProfile = z.infer<typeof profileSchema>;
export type OwnerPlace = OwnerProfile & { id: string; status: string; updated_at: number; featured?: boolean; pro_until?: string | null };
export type OwnerAsset = { id: string; place_id: string; filename: string; content_type: string; purpose: string; completed: boolean; published: boolean; caption: string; alt_text: string; url: string };
export type OwnerRequest = { id: string; place_id: string; user_id: string; email: string; kind: 'claim' | 'changes' | 'payment'; status: string; payload: Record<string, unknown>; baseline: Record<string, unknown>; evidence_ids: string[]; review_note: string; created_at: string; places?: { name: string; barangay: string } };
export const editableFields = ['name', 'type', 'barangay', 'description', 'address', 'phone', 'website', 'booking_url', 'display_latitude', 'display_longitude', 'cover_media_id', 'photo_ids_json', 'owner_details'] as const;
export function profileOf(place: Record<string, unknown>): OwnerProfile {
  return Object.fromEntries(editableFields.map(k => [k, place[k] ?? (k === 'owner_details' ? { hours: '', amenities: '', services: '', offers: '', social: '', closure: 'open' } : k === 'photo_ids_json' ? [] : '')])) as OwnerProfile;
}
export function nextProExpiry(existing: string | null, now = new Date()) {
  const base = existing && new Date(existing) > now ? new Date(existing) : new Date(now);
  const day = base.getUTCDate(); base.setUTCDate(1); base.setUTCMonth(base.getUTCMonth() + 1);
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, last)); return base.toISOString();
}
