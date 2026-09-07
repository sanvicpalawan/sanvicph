import { SESSION_COOKIE, json, requireAdmin, sha256 } from "@/lib/admin-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try { return json({ authenticated: await requireAdmin(request) }); }
  catch { return json({ authenticated: false }); }
}

export async function POST(request: Request) {
  try {
    const { pin } = await request.json() as { pin?: string };
    const adminPin = process.env.ADMIN_PIN;
    if (!adminPin) return json({ error: "Admin sign-in is not configured." }, 500);
    const supplied = await sha256(String(pin || ""));
    const expected = await sha256(adminPin);
    if (supplied !== expected) return json({ error: "That passkey is not correct." }, 401);
    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const tokenHash = await sha256(token);
    const now = Date.now();
    const expires = now + 8 * 60 * 60 * 1000;
    const db = supabaseAdmin();
    await db.from("admin_sessions").delete().lte("expires_at", now);
    await db.from("admin_sessions").insert({ id: crypto.randomUUID(), token_hash: tokenHash, expires_at: expires, created_at: now });
    return json({ authenticated: true }, 200, { "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` });
  } catch { return json({ error: "Unable to sign in right now." }, 500); }
}

export async function DELETE(request: Request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) || "";
    if (token) await supabaseAdmin().from("admin_sessions").delete().eq("token_hash", await sha256(token));
  } catch {}
  return json({ authenticated: false }, 200, { "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` });
}
