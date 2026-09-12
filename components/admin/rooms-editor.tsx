"use client";

import { useState } from "react";
import { BedDouble, Pencil, Plus, Trash2, X } from "lucide-react";
import type { MediaAsset, PlaceRoom } from "@/lib/cms-types";
import InlineMediaPicker from "./inline-media-picker";

const newRoom = (): PlaceRoom => ({ id: crypto.randomUUID(), name: "", units: 1, size: "", beds: "", description: "", chips: [], groups: [], photoIds: [], bookingUrl: "" });

const parseList = (text: string) => text.split(/[\n,]+/).map((part) => part.trim()).filter(Boolean);

// Free-text field that commits a parsed list (commas or line breaks) to the room.
// Keeps the raw text locally while focused so typing a comma or newline is easy,
// and resyncs from the room when it changes from elsewhere.
function LooseList({ value, onCommit, placeholder, textarea = false, rows = 4 }: { value: string[]; onCommit: (list: string[]) => void; placeholder?: string; textarea?: boolean; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  const [focused, setFocused] = useState(false);
  const external = value.join("\n");
  if (!focused && text !== external) setText(external);
  const commit = (next: string) => { setText(next); onCommit(parseList(next)); };
  const shared = { value: text, placeholder, onChange: (event: { target: { value: string } }) => commit(event.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false) } as const;
  return textarea ? <textarea rows={rows} {...shared}/> : <input {...shared}/>;
}

type Props = {
  rooms: PlaceRoom[];
  onChange: (rooms: PlaceRoom[]) => void;
  media: MediaAsset[];
  reload: () => void | Promise<void>;
  setMessage: (message: string) => void;
};

export default function RoomsEditor({ rooms, onChange, media, reload, setMessage }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const imagesFor = (room: PlaceRoom) => room.photoIds.map((id) => media.find((asset) => asset.id === id && asset.status === "active" && asset.contentType.startsWith("image/"))).filter((asset): asset is MediaAsset => Boolean(asset));

  const patch = (id: string, changes: Partial<PlaceRoom>) => onChange(rooms.map((room) => (room.id === id ? { ...room, ...changes } : room)));
  const addRoom = () => { const room = newRoom(); onChange([...rooms, room]); setOpenId(room.id); };
  const removeRoom = (room: PlaceRoom) => { if (!confirm(`Remove “${room.name || "this room type"}” from this location? Its photos stay in the media library.`)) return; onChange(rooms.filter((entry) => entry.id !== room.id)); if (openId === room.id) setOpenId(null); };

  return (
    <section className="inline-media-picker rooms-editor">
      <div className="inline-media-title">
        <div>
          <p className="admin-kicker">Rooms &amp; stays</p>
          <h3>Room types</h3>
          <span>Each room type gets its own photos, details and rate on the public page. Changes are saved with the location — click Save all changes to keep them.</span>
        </div>
        <button type="button" className="admin-primary" onClick={addRoom}><Plus/>Add room type</button>
      </div>
      {!rooms.length && <p className="admin-empty inline-empty">No room types yet. Add the first one to show a “Rooms &amp; stays” section on the public page.</p>}
      {rooms.map((room, index) => {
        const images = imagesFor(room);
        const open = openId === room.id;
        return (
          <article key={room.id} className={`room-editor-card ${open ? "open" : ""}`}>
            <div className="room-editor-head">
              <button type="button" className="room-editor-thumb" onClick={() => setOpenId(open ? null : room.id)} aria-expanded={open} aria-label={`Edit ${room.name || `room type ${index + 1}`}`}>
                {images[0] ? <img src={images[0].url} alt=""/> : <BedDouble/>}
              </button>
              <div className="room-editor-meta">
                <strong>{room.name || "Untitled room type"}</strong>
                <small>{[room.units ? `${room.units} unit${room.units === 1 ? "" : "s"}` : "", room.size, room.beds, images.length ? `${images.length} photo${images.length === 1 ? "" : "s"}` : "no photos yet"].filter(Boolean).join(" · ")}</small>
              </div>
              <div className="admin-row-actions">
                <button type="button" onClick={() => setOpenId(open ? null : room.id)}>{open ? <X/> : <Pencil/>}{open ? "Close" : "Edit"}</button>
                <button type="button" className="danger" onClick={() => removeRoom(room)}><Trash2/>Remove</button>
              </div>
            </div>
            {open && (
              <div className="room-editor-body">
                <div className="admin-form-grid">
                  <label className="admin-field admin-field-wide"><span>Room name <b>*</b></span><input value={room.name} placeholder="Double Room with Patio" onChange={(event) => patch(room.id, { name: event.target.value })}/></label>
                  <label className="admin-field"><span>Units available</span><input type="number" min={1} value={room.units ?? ""} onChange={(event) => patch(room.id, { units: event.target.value === "" ? undefined : Math.max(1, Number(event.target.value)) })}/></label>
                  <label className="admin-field"><span>Size</span><input value={room.size || ""} placeholder="20 m²" onChange={(event) => patch(room.id, { size: event.target.value })}/></label>
                  <label className="admin-field"><span>Beds</span><input value={room.beds || ""} placeholder="1 queen bed" onChange={(event) => patch(room.id, { beds: event.target.value })}/></label>
                  <label className="admin-field"><span>Rate from (₱, optional)</span><input type="number" min={0} value={room.rateFrom ?? ""} placeholder="1800" onChange={(event) => patch(room.id, { rateFrom: event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)) })}/></label>
                  <label className="admin-field"><span>Rate note</span><input value={room.rateNote || ""} placeholder="per night · breakfast included" onChange={(event) => patch(room.id, { rateNote: event.target.value })}/></label>
                  <label className="admin-field admin-field-wide"><span>Direct booking URL <small>own reservation page / Viber / email — not a third-party site</small></span><input value={room.bookingUrl || ""} placeholder="https://your-site.com/rooms/double-room · viber://chat?number=0917… · mailto:… · tel:…" onChange={(event) => patch(room.id, { bookingUrl: event.target.value })}/></label>
                  <label className="admin-field admin-field-wide"><span>Public description</span><textarea rows={3} value={room.description || ""} onChange={(event) => patch(room.id, { description: event.target.value })}/></label>
                  <label className="admin-field admin-field-wide"><span>Highlight chips <small>comma separated · shown as tags under the room name</small></span><LooseList value={room.chips || []} placeholder="Sea view, Air conditioning, Free Wifi" onCommit={(chips) => patch(room.id, { chips })}/></label>
                </div>
                <div className="room-groups">
                  <div className="room-groups-head"><div><strong>Amenity lists</strong><small>Grouped checklists like “In your private bathroom”, “View”, “Facilities”</small></div><button type="button" onClick={() => patch(room.id, { groups: [...(room.groups || []), { title: "Amenities", items: [] }] })}><Plus/>Add list</button></div>
                  {(room.groups || []).map((group, groupIndex) => (
                    <div className="room-group-editor" key={`${room.id}-${groupIndex}`}>
                      <div className="admin-form-grid">
                        <label className="admin-field"><span>List title</span><input value={group.title} placeholder="Facilities" onChange={(event) => { const groups = (room.groups || []).map((entry, entryIndex) => (entryIndex === groupIndex ? { ...entry, title: event.target.value } : entry)); patch(room.id, { groups }); }}/></label>
                        <label className="admin-field admin-field-wide"><span>Items <small>one per line, or comma separated</small></span><LooseList value={group.items} rows={Math.min(12, Math.max(4, Math.ceil(group.items.length / 2)))} placeholder={"Air conditioning\nFree Wifi\nSea view"} textarea onCommit={(items) => { const groups = (room.groups || []).map((entry, entryIndex) => (entryIndex === groupIndex ? { ...entry, items } : entry)); patch(room.id, { groups }); }}/></label>
                      </div>
                      <button type="button" className="room-group-remove" onClick={() => patch(room.id, { groups: (room.groups || []).filter((_, entryIndex) => entryIndex !== groupIndex) })}><Trash2/>Remove list</button>
                    </div>
                  ))}
                </div>
                <InlineMediaPicker media={media} selectedIds={room.photoIds} onChange={(photoIds) => patch(room.id, { photoIds })} reload={reload} setMessage={setMessage} label={`Photos · ${room.name || "this room type"}`}/>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
