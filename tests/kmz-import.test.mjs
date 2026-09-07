import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { parseKmz } from "../lib/kmz-parser.ts";

test("imports only KMZ point placemarks and maps their barangay", () => {
  const kml = `<?xml version="1.0"?><kml><Document><name>Test locations</name><Folder><name>TREs Cluster Poblacion</name><Placemark><name>Draft Stay</name><Point><coordinates>119.3412,10.5311,0</coordinates></Point></Placemark><Placemark><name>Road</name><LineString><coordinates>119.1,10.4 119.2,10.5</coordinates></LineString></Placemark></Folder></Document></kml>`;
  const kmz = zipSync({ "doc.kml": strToU8(kml) });
  const result = parseKmz(kmz);
  assert.equal(result.totalPlacemarks, 2);
  assert.equal(result.locations.length, 1);
  assert.equal(result.ignoredCount, 1);
  assert.equal(result.locations[0].barangay, "Poblacion");
  assert.equal(result.locations[0].latitude, 10.5311);
  assert.equal(result.locations[0].longitude, 119.3412);
});

test("draft import and published-only map rules are enforced in server routes", async () => {
  const [importRoute,publicRoute,client] = await Promise.all([
    readFile(new URL("../app/api/admin/locations/import-kmz/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/public/site/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../components/sanvic-app.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(importRoute,/status: "draft"/);
  assert.match(importRoute,/db\.from\("places"\)\.insert/);
  assert.match(publicRoute,/\.eq\("status", "published"\)/);
  assert.match(client,/place\.status==="published"/);
});
