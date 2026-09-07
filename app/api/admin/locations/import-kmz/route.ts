import { audit, cleanText, json, requireAdmin, sha256 } from "@/lib/admin-server";
import { parseKmz } from "@/lib/kmz-parser";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MAX_KMZ_BYTES = 8 * 1024 * 1024;

const duplicateKey = (name: string, latitude: number, longitude: number) =>
  `${name.trim().toLocaleLowerCase()}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return json({ error: "Unauthorized" }, 401);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose a KMZ file to import." }, 400);
    if (!file.name.toLowerCase().endsWith(".kmz")) return json({ error: "Only .kmz files are supported." }, 400);
    if (file.size > MAX_KMZ_BYTES) return json({ error: "The KMZ file must be 8 MB or smaller." }, 413);

    const parsed = parseKmz(new Uint8Array(await file.arrayBuffer()));
    if (!parsed.locations.length) return json({ error: "No valid point locations were found. Roads and boundary shapes are not imported." }, 400);

    const db = supabaseAdmin();
    const { data: existing, error: existingError } = await db
      .from("places")
      .select("name, display_latitude, display_longitude")
      .neq("status", "archived");
    if (existingError) return json({ error: existingError.message }, 500);

    const known = new Set((existing ?? []).map((place) => duplicateKey(
      String(place.name ?? ""), Number(place.display_latitude), Number(place.display_longitude),
    )));
    const now = Date.now();
    const importId = crypto.randomUUID();
    const rows: Record<string, unknown>[] = [];
    let duplicateCount = 0;

    for (const location of parsed.locations) {
      const key = duplicateKey(location.name, location.latitude, location.longitude);
      if (known.has(key)) { duplicateCount += 1; continue; }
      known.add(key);
      rows.push({
        id: crypto.randomUUID(),
        name: cleanText(location.name, 180),
        type: cleanText(location.type, 80),
        barangay: cleanText(location.barangay, 80),
        google_maps_url: "",
        google_place_id: `kmz:${await sha256(location.sourceKeySeed)}`,
        source_latitude: location.latitude,
        source_longitude: location.longitude,
        display_latitude: location.latitude,
        display_longitude: location.longitude,
        address: "",
        phone: "",
        website: "",
        description: cleanText(location.description),
        booking_url: "",
        cover_media_id: "",
        photo_ids_json: [],
        status: "draft",
        featured: false,
        verified: false,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      });
    }

    for (let index = 0; index < rows.length; index += 100) {
      const { error } = await db.from("places").insert(rows.slice(index, index + 100));
      if (error) return json({ error: error.message }, 500);
    }

    const filename = cleanText(file.name, 240);
    const warningCount = parsed.locations.filter((location) => location.warnings.length > 0).length;
    await audit("import", "location_batch", importId, `Imported ${rows.length} draft locations from ${filename}; ${duplicateCount} duplicates skipped`);

    return json({
      import: {
        id: importId,
        filename,
        documentName: parsed.documentName,
        status: "completed",
        totalPlacemarks: parsed.totalPlacemarks,
        pointCount: parsed.locations.length,
        importedCount: rows.length,
        duplicateCount,
        ignoredCount: parsed.ignoredCount,
        warningCount,
        createdAt: now,
      },
      message: `${rows.length} locations imported as Draft. Nothing was published to Explore.`,
    }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The KMZ import failed." }, 500);
  }
}
