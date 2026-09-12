import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLACE_LINK_ICONS, PLACE_LINK_ICON_NAMES, placeLinkIcon } from "../lib/place-links.ts";

test("links column is an additive one-time setup file", async () => {
  const sql = await readFile(new URL("../docs/links-setup.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.places add column if not exists links_json jsonb/);
});

test("admin sanitizes links server-side and degrades gracefully before setup runs", async () => {
  const route = await readFile(new URL("../app/api/admin/data/route.ts", import.meta.url), "utf8");
  assert.match(route, /const sanitizeLinks/);
  assert.match(route, /https.*test\(link\.url\)/); // only http(s) URLs survive
  assert.match(route, /PLACE_LINK_ICON_NAMES\.includes/); // icon names are whitelisted
  assert.match(route, /links_json/);
  assert.match(route, /docs\/links-setup\.sql/); // friendly pointer when the column is missing
});

test("public site only exposes links for published places, with legacy fields intact", async () => {
  const route = await readFile(new URL("../app/api/public/site/route.ts", import.meta.url), "utf8");
  assert.match(route, /\.eq\("status", "published"\)/);
  assert.match(route, /links:Array\.isArray\(r\.links_json\)\?r\.links_json:\[\]/);
  assert.match(route, /phone:r\.phone/);
  assert.match(route, /website:r\.website/);
  assert.match(route, /bookingUrl:r\.booking_url/);
});

test("curated Lucide icon set is unique, complete and always resolves", () => {
  assert.ok(PLACE_LINK_ICONS.length >= 20, "curated set should offer a meaningful choice");
  const names = new Set(PLACE_LINK_ICONS.map((option) => option.name));
  assert.equal(names.size, PLACE_LINK_ICONS.length, "icon names must be unique");
  for (const name of names) assert.equal(placeLinkIcon(name), PLACE_LINK_ICONS.find((option) => option.name === name).Icon);
  for (const [index, name] of PLACE_LINK_ICON_NAMES.entries()) assert.equal(name, PLACE_LINK_ICONS[index].name);
  // Unknown or missing names fall back to a real component instead of breaking the page.
  assert.ok(placeLinkIcon());
  assert.ok(placeLinkIcon("NotAnIcon"));
});

test("admin editor and public page both build on the shared icon list", async () => {
  const [editor, page] = await Promise.all([
    readFile(new URL("../components/admin/links-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/public-media.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /PLACE_LINK_ICONS/); // picker grid renders the curated set
  assert.match(page, /placeLinkIcon/); // public pills resolve through the shared helper
  assert.match(page, /placeContactActions/); // links merge with phone/website/bookingUrl
});
