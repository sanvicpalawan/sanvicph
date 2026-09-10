import { json } from "@/lib/admin-server";
import { getTraveler, createTraveler, travelerError, assertSameOrigin, cleanNickname } from "@/lib/traveler-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const traveler = await getTraveler(request);
  return json({ traveler });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const existing = await getTraveler(request);
    if (existing) return json({ traveler: existing });
    const { nickname } = (await request.json()) as { nickname?: string };
    const { traveler, setCookie } = await createTraveler(nickname || "");
    return json({ traveler }, 200, { "Set-Cookie": setCookie });
  } catch (error) {
    return travelerError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const traveler = await getTraveler(request);
    if (!traveler) throw new Error("No traveler for this device yet.");
    const nickname = cleanNickname((await request.json()).nickname);
    if (!nickname) throw new Error("Enter a nickname to continue.");
    const { error } = await supabaseAdmin().from("travelers").update({ nickname }).eq("id", traveler.id);
    if (error) throw error;
    return json({ traveler: { ...traveler, nickname } });
  } catch (error) { return travelerError(error); }
}
