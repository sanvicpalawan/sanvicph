import { cleanText, json, requireAdmin } from "@/lib/admin-server";

function extractCoordinates(value: string) {
  const decoded = decodeURIComponent(value);
  // Order matters: !3d!4d is Google's precise pin location. @lat,lng is only the
  // map viewport center at share-time, which can drift from the actual pin if
  // the map was panned — so it must be tried last, not first.
  const patterns = [/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|center)=(-?\d{1,3}\.\d+)[,%2C\s]+(-?\d{1,3}\.\d+)/i, /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/];
  for (const pattern of patterns) { const match = decoded.match(pattern); if (match) return { latitude: Number(match[1]), longitude: Number(match[2]) }; }
  return null;
}

export async function POST(request: Request) {
  try {
    if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);
    const { url } = await request.json() as { url?: string }; const originalUrl = cleanText(url, 3000);
    if (!/^https?:\/\//i.test(originalUrl)) return json({ error: "Paste a valid Google Maps URL." }, 400);
    let resolvedUrl = originalUrl; let pageTitle = ""; let coordinates = extractCoordinates(originalUrl);
    try {
      const response = await fetch(originalUrl, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; SANVICAdmin/1.0)" } });
      resolvedUrl = response.url || originalUrl; coordinates ||= extractCoordinates(resolvedUrl);
      if (!coordinates || !pageTitle) {
        const html = await response.text(); coordinates ||= extractCoordinates(html);
        pageTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<title>([^<]+)/i)?.[1] || "").replace(/ - Google Maps.*$/i, "").trim();
      }
    } catch {}
    return json({
      resolvedUrl,
      name: pageTitle,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      warning: coordinates ? "Coordinates were extracted from the Maps link. Review the barangay and marker before publishing." : "This link does not expose coordinates. Open the place in Google Maps, choose Share, copy the full link, or enter the marker manually.",
      photos: [],
      photoNotice: "Google Maps photos are not copied automatically. Upload licensed business photos in Media and attach them here.",
    });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to inspect this Maps link." }, 500); }
}
