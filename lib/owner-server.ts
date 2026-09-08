import { supabaseAdmin } from './supabase-admin';
import { json } from './admin-server';
import { OPEN_OWNER_BUILDER_MODE } from './owner-types';

const OPEN_BUILDER_EMAIL = 'open-owner-builder@sanvic.local';
let openBuilderPromise: ReturnType<typeof createOpenBuilder> | null = null;

async function createOpenBuilder() {
  const auth = supabaseAdmin().auth.admin;
  const { data: listed, error: listError } = await auth.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find(user => user.email === OPEN_BUILDER_EMAIL);
  if (existing) return existing;
  const { data, error } = await auth.createUser({ email: OPEN_BUILDER_EMAIL, email_confirm: true, app_metadata: { sanvic_open_builder: true } });
  if (error || !data.user) throw error || new Error('Unable to open the temporary owner workspace.');
  return data.user;
}

async function openBuilderUser() {
  openBuilderPromise ||= createOpenBuilder();
  try { return await openBuilderPromise; }
  catch (error) { openBuilderPromise = null; throw error; }
}

export async function ownerUser(request: Request) {
  if (OPEN_OWNER_BUILDER_MODE) return openBuilderUser();
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) throw new Error('Sign in to manage your locations.');
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) throw new Error('Sign in with a verified email to continue.');
  return data.user;
}
export async function requireManager(userId: string, placeId: string) {
  if (OPEN_OWNER_BUILDER_MODE && userId === (await openBuilderUser()).id) return;
  const { data, error } = await supabaseAdmin().from('location_managers').select('user_id').eq('place_id', placeId).eq('user_id', userId).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('An approved owner account is required for this location.');
}
export function ownerError(error: unknown) {
  const message = error instanceof Error ? error.message : (error as {message?: string})?.message || 'Unable to complete this request.';
  if (/schema cache|does not exist/i.test(message)) return json({ error: 'Owner portal setup is pending. Please contact merqatodigital@proton.me.' }, 503);
  return json({ error: message }, /Sign in/.test(message) ? 401 : /approved owner/.test(message) ? 403 : 400);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new Error('Invalid request origin.');
}
