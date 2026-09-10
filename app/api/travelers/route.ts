import { json } from "@/lib/admin-server";
import { getTraveler, createTraveler, travelerError } from "@/lib/traveler-server";

export async function GET(request: Request) {
  const traveler = await getTraveler(request);
  return json({ traveler });
}

export async function POST(request: Request) {
  try {
    const existing = await getTraveler(request);
    if (existing) return json({ traveler: existing });
    const { nickname } = (await request.json()) as { nickname?: string };
    const { traveler, setCookie } = await createTraveler(nickname || "");
    return json({ traveler }, 200, { "Set-Cookie": setCookie });
  } catch (error) {
    return travelerError(error);
  }
}
