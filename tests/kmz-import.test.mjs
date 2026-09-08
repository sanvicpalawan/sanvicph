import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { isNearDuplicate, parseKmz } from "../lib/kmz-parser.ts";

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

test("tourist destination batches become coordinate-assigned sightseeing drafts", () => {
  const kml = `<?xml version="1.0"?><kml><Document><name>San Vicente Tourist Destinations</name><Placemark><name>Coconut Beach</name><Point><coordinates>119.160896,10.4107177,0</coordinates></Point></Placemark><Placemark><name>Choke point 1</name><Point><coordinates>119.332225,10.660717,0</coordinates></Point></Placemark></Document></kml>`;
  const result = parseKmz(zipSync({ "doc.kml": strToU8(kml) }));
  assert.equal(result.totalPlacemarks, 2);
  assert.equal(result.locations.length, 1);
  assert.equal(result.ignoredCount, 1);
  assert.equal(result.locations[0].type, "Sightseeing");
  assert.equal(result.locations[0].barangay, "Port Barton");
  assert.match(result.locations[0].warnings.join(" "), /assigned from coordinates/i);
});

test("near-identical named points are treated as duplicates", () => {
  assert.equal(isNearDuplicate(
    { name: "SanVic Viewpoint", latitude: 10.658835, longitude: 119.3304333 },
    { name: "SanVic Viewpoint", latitude: 10.65884, longitude: 119.33044 },
  ), true);
  assert.equal(isNearDuplicate(
    { name: "Coconut Beach", latitude: 10.4107177, longitude: 119.160896 },
    { name: "Coconut Beach", latitude: 10.5107177, longitude: 119.160896 },
  ), false);
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
