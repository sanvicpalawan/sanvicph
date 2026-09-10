import { supabaseAdmin } from "./supabase-admin";
import { json, cookieValue, sha256 } from "./admin-server";

export const TRAVELER_COOKIE = "sanvic_traveler";
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year, one device = one identity

export function travelerCookieHeader(token: string, maxAgeSeconds: number) {
  return `${TRAVELER_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function cleanNickname(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return trimmed.slice(0, 24);
}

export type Traveler = { id: string; nickname: string };

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new Error("Invalid request origin.");
}

export async function getTraveler(request: Request): Promise<Traveler | null> {
  const token = cookieValue(request, TRAVELER_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const { data } = await supabaseAdmin()
    .from("traveler_sessions")
    .select("expires_at, travelers(id, nickname)")
    .eq("token_hash", tokenHash)
    .gt("expires_at", Date.now())
    .limit(1)
    .maybeSingle();
  const traveler = data?.travelers as unknown as { id: string; nickname: string } | null;
  return traveler ? { id: traveler.id, nickname: traveler.nickname } : null;
}

export async function requireTraveler(request: Request): Promise<Traveler> {
  const traveler = await getTraveler(request);
  if (!traveler) throw new Error("No traveler for this device yet.");
  return traveler;
}

// Creates a brand new traveler + session. Only call when getTraveler() returned null —
// this always mints a new identity, it never reuses/renames an existing one.
export async function createTraveler(nickname: string): Promise<{ traveler: Traveler; setCookie: string }> {
  const clean = cleanNickname(nickname);
  if (!clean) throw new Error("Enter a nickname to continue.");
  const db = supabaseAdmin();
  const now = Date.now();
  const { data: traveler, error: travelerError } = await db
    .from("travelers")
    .insert({ nickname: clean, created_at: now })
    .select("id, nickname")
    .single();
  if (travelerError || !traveler) throw travelerError || new Error("Unable to create traveler.");

  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const tokenHash = await sha256(token);
  const expires = now + SESSION_TTL_MS;
  await db.from("traveler_sessions").delete().lte("expires_at", now);
  const { error: sessionError } = await db
    .from("traveler_sessions")
    .insert({ traveler_id: traveler.id, token_hash: tokenHash, expires_at: expires });
  if (sessionError) throw sessionError;

  return { traveler, setCookie: travelerCookieHeader(token, SESSION_TTL_MS / 1000) };
}

export function travelerError(error: unknown) {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message || "Unable to complete this request.";
  if (/schema cache|does not exist/i.test(message)) return json({ error: "Travelers setup is pending. Please contact merqatodigital@proton.me." }, 503);
  return json({ error: message }, /No traveler/.test(message) ? 401 : 400);
}
