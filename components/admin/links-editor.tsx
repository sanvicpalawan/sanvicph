"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { PlaceLink } from "@/lib/cms-types";
import { GENERIC_LINK_ICONS, PLATFORM_LINK_ICONS, placeLinkIcon, type PlaceLinkIconOption } from "@/lib/place-links";

const newLink = (): PlaceLink => ({ id: crypto.randomUUID(), label: "", url: "", icon: "ExternalLink" });

type Props = {
  links: PlaceLink[];
  onChange: (links: PlaceLink[]) => void;
};

// Repeatable booking / web links for a location: add, edit, delete and reorder rows,
// each with a label, a URL and an icon — platform marks first (Booking.com, Agoda, …),
// generic Lucide icons after. Picking an icon fills an empty label and, for platforms,
// the canonical URL (never overwriting what the admin already typed).
export default function LinksEditor({ links, onChange }: Props) {
  const [pickerId, setPickerId] = useState<string | null>(null);
  const patch = (id: string, changes: Partial<PlaceLink>) => onChange(links.map((link) => (link.id === id ? { ...link, ...changes } : link)));
  const selectIcon = (link: PlaceLink, option: PlaceLinkIconOption) => {
    patch(link.id, { icon: option.name, label: link.label || option.label, url: link.url || option.platform || "" });
  };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const addLink = () => { const link = newLink(); onChange([...links, link]); setPickerId(link.id); };
  const removeLink = (link: PlaceLink) => {
    if (!confirm(`Remove “${link.label || "this link"}” from this location?`)) return;
    onChange(links.filter((entry) => entry.id !== link.id));
    if (pickerId === link.id) setPickerId(null);
  };
  const iconButton = (link: PlaceLink, option: PlaceLinkIconOption) => {
    const OptionIcon = option.Icon;
    const selected = link.icon === option.name;
    return <button key={option.name} type="button" className={selected ? "active" : ""} aria-pressed={selected} aria-label={option.label} title={option.label} onClick={() => selectIcon(link, option)}><OptionIcon/></button>;
  };

  return (
    <section className="links-editor inline-media-picker">
      <div className="inline-media-title">
        <div>
          <p className="admin-kicker">Booking &amp; web links</p>
          <h3>Links</h3>
          <span>Repeatable links shown as tappable pills near the top of the public page. Pick a platform and its label and website fill in — replace the URL with this location&rsquo;s own page when it has one. Reorder with the arrows, then save the location. Empty when nothing is added.</span>
        </div>
        <button type="button" className="admin-primary" onClick={addLink}><Plus/>Add link</button>
      </div>
      {!links.length && <p className="admin-empty inline-empty">No links yet. Add the first one to show a “Book or connect” pill row on the public page.</p>}
      {links.map((link, index) => {
        const Icon = placeLinkIcon(link.icon);
        const pickerOpen = pickerId === link.id;
        return (
          <article key={link.id} className={`link-editor-row ${pickerOpen ? "open" : ""}`}>
            <div className="link-editor-line">
              <button type="button" className={`link-editor-icon ${pickerOpen ? "active" : ""}`} onClick={() => setPickerId(pickerOpen ? null : link.id)} aria-expanded={pickerOpen} aria-label={`Change icon for ${link.label || `link ${index + 1}`}`} title="Change icon">
                <Icon/>
              </button>
              <input className="link-editor-input" value={link.label} placeholder="Label · Booking.com" aria-label="Link label" onChange={(event) => patch(link.id, { label: event.target.value })}/>
              <input className="link-editor-input link-editor-url" value={link.url} placeholder="https://www.booking.com/…" aria-label="Link URL" onChange={(event) => patch(link.id, { url: event.target.value })}/>
              <div className="admin-row-actions">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move link up"><ChevronUp/></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === links.length - 1} aria-label="Move link down"><ChevronDown/></button>
                <button type="button" className="danger" onClick={() => removeLink(link)}><Trash2/>Remove</button>
              </div>
            </div>
            {pickerOpen && (
              <div className="link-icon-picker" aria-label={`Icon for ${link.label || `link ${index + 1}`}`}>
                <div className="link-icon-group"><small>Platforms</small><div className="link-icon-grid">{PLATFORM_LINK_ICONS.map((option) => iconButton(link, option))}</div></div>
                <div className="link-icon-group"><small>Generic</small><div className="link-icon-grid">{GENERIC_LINK_ICONS.map((option) => iconButton(link, option))}</div></div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
