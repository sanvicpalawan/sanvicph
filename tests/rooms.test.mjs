import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("per-room direct booking URL is optional, sanitized and shown as a full-width Book-direct button", async () => {
  const [types, route, editor, sheet, css] = await Promise.all([
    readFile(new URL("../lib/cms-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/data/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/admin/rooms-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/public-media.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // cms-types: PlaceRoom has optional bookingUrl
  assert.match(types, /bookingUrl\?: string/);

  // server sanitization: only https / tel / mailto / viber survive
  assert.match(route, /sanitizeRooms/);
  assert.match(route, /bookingUrl/);
  // must check all four allowed schemes
  assert.match(route, /https:/);
  assert.match(route, /tel:/);
  assert.match(route, /mailto:/);
  assert.match(route, /viber:/);
  // the sanitizer should use a single regex that tests those four (allow escaped slashes)
  assert.match(route, /\^\(https/);

  // stored inside existing rooms_json — no schema change / no new column
  assert.match(route, /rooms_json/);
  assert.doesNotMatch(route, /alter table.*rooms/);

  // admin editor has Direct booking URL field
  assert.match(editor, /Direct booking URL/);
  assert.match(editor, /bookingUrl/);
  assert.match(editor, /own reservation page \/ Viber \/ email/);

  // public sheet: full-width "Book <room> directly" button, hidden when empty
  assert.match(sheet, /room\.bookingUrl/);
  assert.match(sheet, /Book.*directly/);
  // hidden when empty -> conditional rendering
  assert.match(sheet, /room\.bookingUrl\s*&&/);
  // button uses the room name in its label
  assert.match(sheet, /room\.name/);

  // CSS: full-width button class
  assert.match(css, /\.room-book-direct/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /room-book-direct/);
});
