"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, BedDouble, Check, ChevronLeft, ChevronRight, DoorOpen, ExternalLink, Globe2, Image as ImageIcon, MapPin, Maximize2, Phone, Play, Route, Ruler, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLightbox, HeroExpandButton } from "@/components/lightbox";
import type { MediaAsset, Place, PlaceRoom } from "@/lib/cms-types";
import { placeLinkIcon } from "@/lib/place-links";
import { pictures } from "@/lib/sanvic-data";

// Merged booking/contact actions: curated Links first (admin order), then the older
// phone / website / bookingUrl fields, all rendered as the same compact pills.
type PlaceContactAction = { key: string; label: string; href: string; icon?: string; external: boolean };
const linkHost = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "") || url; } catch { return url; } };
export function placeContactActions(place: Place): PlaceContactAction[] {
  const actions: PlaceContactAction[] = [];
  for (const link of place.links || []) {
    if (!link.url) continue;
    actions.push({ key: link.id || link.url, label: link.label || linkHost(link.url), href: link.url, icon: link.icon, external: true });
  }
  if (place.phone) actions.push({ key: "phone", label: place.phone, href: `tel:${place.phone.replace(/\D/g, "")}`, icon: "Phone", external: false });
  if (place.website) actions.push({ key: "website", label: linkHost(place.website), href: place.website, icon: "Globe", external: true });
  if (place.bookingUrl) actions.push({ key: "booking", label: "Contact or booking", href: place.bookingUrl, icon: "ExternalLink", external: true });
  return actions;
}

export function mediaFor(ids: string[] | undefined, media: MediaAsset[]) {
  const byId = new Map(media.map((asset) => [asset.id, asset]));
  return (ids || []).map((id) => byId.get(id)).filter((asset): asset is MediaAsset => Boolean(asset));
}

export function roomImages(room: PlaceRoom, media: MediaAsset[]) {
  const byId = new Map(media.map((asset) => [asset.id, asset]));
  return room.photoIds.map((id) => byId.get(id)).filter((asset): asset is MediaAsset => asset !== undefined && asset.contentType.startsWith("image/"));
}

function firstRoomImage(place: Place, media: MediaAsset[]) {
  for (const room of place.rooms || []) {
    const image = roomImages(room, media)[0];
    if (image) return image;
  }
  return undefined;
}

const unitsLabel = (units?: number) => (units && units > 0 ? `${units} unit${units > 1 ? "s" : ""}` : "");
const rateAmount = (value: number) => `₱${value.toLocaleString()}`;

export function MediaGallery({ ids, media, title = "In this story", compact = false }: { ids?: string[]; media: MediaAsset[]; title?: string; compact?: boolean }) {
  const assets = mediaFor(ids, media);
  const openLightbox = useLightbox();
  if (!assets.length) return null;
  const images = assets.filter((asset) => !asset.contentType.startsWith("video/")).map((asset) => ({ src: asset.url, alt: asset.altText || asset.caption || title, caption: asset.caption }));
  return <section className={`public-media-gallery ${compact ? "compact" : ""}`}>
    <div className="public-media-heading"><p className="eyebrow">Photos & video</p><h2>{title}</h2></div>
    <div className="public-media-grid">{assets.map((asset) => <figure key={asset.id}>
      {asset.contentType.startsWith("video/") ? <div className="public-video"><video controls playsInline preload="metadata" src={asset.url}/><span><Play/>Video</span></div> : <button type="button" className="media-grid-image" onClick={() => openLightbox(images, images.findIndex((image) => image.src === asset.url))} aria-label={`View larger: ${asset.caption || asset.altText || title}`}><img src={asset.url} alt={asset.altText || asset.caption || ""} loading="lazy"/></button>}
      {(asset.caption || asset.altText) && <figcaption>{asset.caption || asset.altText}</figcaption>}
    </figure>)}</div>
  </section>;
}

export function PlaceCard({ place, media, onOpen }: { place: Place; media: MediaAsset[]; onOpen: () => void }) {
  const cover = media.find((asset) => asset.id === place.coverMediaId) || mediaFor(place.photoIds, media).find((asset) => asset.contentType.startsWith("image/")) || firstRoomImage(place, media);
  return <article className="place-card">
    <button className="place-card-photo" onClick={onOpen} aria-label={`Explore ${place.name} in SANVIC`}><img src={cover?.url || pictures.stay} alt={cover?.altText || ""} loading="lazy"/></button>
    <div><p className="eyebrow">{place.type} · {place.barangay}</p><h3>{place.name}</h3>{place.proActive&&<span className="pro-label">Featured · SANVIC Pro</span>}<p>{place.description || place.address}</p><button className="place-card-open" onClick={onOpen}><MapPin/>Explore here in SANVIC<ArrowRight/></button></div>
  </article>;
}

export function RoomCard({ room, media, onOpen }: { room: PlaceRoom; media: MediaAsset[]; onOpen: () => void }) {
  const images = roomImages(room, media);
  const cover = images[0];
  return <article className="room-card">
    <button className="room-card-photo" onClick={onOpen} aria-label={`View ${room.name} photos and details`}>
      {cover ? <img src={cover.url} alt={cover.altText || room.name} loading="lazy"/> : <span className="room-card-empty" aria-hidden="true"><BedDouble/></span>}
      <span className="room-card-badge">{unitsLabel(room.units) || "Room type"}</span>
      {images.length > 0 && <span className="room-card-count"><ImageIcon/>{images.length} photo{images.length > 1 ? "s" : ""}</span>}
    </button>
    <div>
      <h3>{room.name}</h3>
      <div className="room-card-facts">
        {room.size && <span><Ruler/>{room.size}</span>}
        {room.beds && <span><BedDouble/>{room.beds}</span>}
      </div>
      {room.rateFrom != null && <p className="room-card-rate">From <strong>{rateAmount(room.rateFrom)}</strong><small>{room.rateNote || " per night"}</small></p>}
      <button className="room-card-open" onClick={onOpen}><span>Room details &amp; photos</span><ArrowRight/></button>
    </div>
  </article>;
}

// Mounted with key={room.id} by PlaceDetail, so index always starts at 0 for a newly opened room.
export function RoomDetail({ room, media, open, onOpenChange }: { room: PlaceRoom; media: MediaAsset[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const images = roomImages(room, media);
  const [index, setIndex] = useState(0);
  const openLightbox = useLightbox();
  const lightboxImages = images.map((asset) => ({ src: asset.url, alt: asset.altText || room.name, caption: asset.caption }));
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="room-sheet" showCloseButton={false}>
      <SheetTitle>{room.name}</SheetTitle>
      <SheetDescription className="sr-only">Room details, amenities and photos for {room.name}</SheetDescription>
      <div className="room-sheet-inner">
        <button type="button" className="icon-button room-sheet-close" onClick={() => onOpenChange(false)} aria-label="Close room details"><X/></button>
        <div className="room-detail-grid">
          <div className="room-detail-media">
            <div className="room-hero">
              {images.length ? <div className="room-hero-stack">
                <div className="room-hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
                  {images.map((asset, imageIndex) => <img key={asset.id} src={asset.url} alt={asset.altText || room.name} loading={imageIndex === 0 ? "eager" : "lazy"} onClick={() => openLightbox(lightboxImages, imageIndex)}/>)}
                </div>
                <span className="room-hero-count">{index + 1} / {images.length}</span>
                <button type="button" className="icon-button hero-expand-button" onClick={() => openLightbox(lightboxImages, index)} aria-label="View larger room photo"><Maximize2/></button>
                {images.length > 1 && <div className="room-hero-controls">
                  <button type="button" className="room-hero-arrow room-hero-prev" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} aria-label="Previous photo"><ChevronLeft/></button>
                  <button type="button" className="room-hero-arrow room-hero-next" onClick={() => setIndex((value) => Math.min(images.length - 1, value + 1))} disabled={index === images.length - 1} aria-label="Next photo"><ChevronRight/></button>
                  <div className="room-hero-dots">{images.map((asset, imageIndex) => <button key={asset.id} type="button" className={imageIndex === index ? "active" : ""} onClick={() => setIndex(imageIndex)} aria-label={`Go to photo ${imageIndex + 1}`}/>)}
                  </div>
                </div>}
              </div> : <div className="room-hero-empty"><BedDouble/><p>No room photos yet — add them from the SANVIC admin.</p></div>}
            </div>
            {images.length > 1 && <div className="room-thumbs" aria-label="All photos of this room">{images.map((asset, imageIndex) => <button type="button" key={asset.id} className={imageIndex === index ? "active" : ""} onClick={() => setIndex(imageIndex)} aria-label={`View photo ${imageIndex + 1}`}><img src={asset.url} alt=""/></button>)}</div>}
          </div>
          <div className="room-detail-info">
            <p className="eyebrow">Room type</p>
            <h2>{room.name}{unitsLabel(room.units) && <small> · {unitsLabel(room.units)}</small>}</h2>
            {room.chips && room.chips.length > 0 && <div className="room-chips">{room.chips.map((chip) => <span key={chip}>{chip}</span>)}</div>}
            <div className="room-facts">
              {room.size && <span><Ruler/>{room.size}</span>}
              {room.beds && <span><BedDouble/>{room.beds}</span>}
              {unitsLabel(room.units) && <span><DoorOpen/>{unitsLabel(room.units)} available</span>}
            </div>
            {room.rateFrom != null && <p className="room-rate">From <strong>{rateAmount(room.rateFrom)}</strong><small>{room.rateNote || " per night"}</small></p>}
            {room.description && <p className="room-description">{room.description}</p>}
            {(room.groups || []).filter((group) => group.items.length > 0).map((group) =>
              group.title.toLowerCase() === "smoking"
                ? <p className="room-smoking" key={group.title}>{group.title}: {group.items.join(", ")}</p>
                : <section className="room-group" key={group.title}><h3>{group.title}:</h3><ul>{group.items.map((item) => <li key={item}><Check size={14}/>{item}</li>)}</ul></section>
            )}
            {room.bookingUrl && (
              <a
                className="room-book-direct"
                href={room.bookingUrl}
                target={room.bookingUrl.startsWith("https://") ? "_blank" : undefined}
                rel={room.bookingUrl.startsWith("https://") ? "noreferrer" : undefined}
              >
                Book {room.name} directly
                <ArrowRight />
              </a>
            )}
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>;
}

export function PlaceSheet({ place, media, onOpen, onDirections }: { place: Place; media: MediaAsset[]; onOpen: () => void; onDirections: () => void }) {
  const assets = mediaFor(place.photoIds, media); const cover = media.find((asset) => asset.id === place.coverMediaId) || assets.find((asset) => asset.contentType.startsWith("image/")) || firstRoomImage(place, media);
  const openLightbox = useLightbox();
  const galleryImages = [cover, ...assets.filter((asset) => asset.id !== cover?.id && asset.contentType.startsWith("image/"))].filter((asset): asset is MediaAsset => Boolean(asset)).map((asset) => ({ src: asset.url, alt: asset.altText || place.name, caption: asset.caption }));
  const rooms = place.rooms || [];
  const roomCovers = rooms.map((room) => roomImages(room, media)[0]).filter((asset): asset is MediaAsset => Boolean(asset));
  return <div className="place-sheet-inner">
    <div className="place-sheet-cover">{cover ? <button type="button" onClick={() => openLightbox(galleryImages, 0)} aria-label={`View larger photo of ${place.name}`}><img src={cover.url} alt={cover.altText || ""}/></button> : <img src={pictures.stay} alt=""/>}<span><MapPin/>{place.type}</span></div>
    <div className="place-sheet-copy"><p className="eyebrow">{place.barangay} · San Vicente</p><h2>{place.name}</h2><p>{place.description || place.address}</p>
      {rooms.length > 0 && <div className="place-sheet-rooms">
        {roomCovers.slice(0, 3).map((asset) => <img key={asset.id} src={asset.url} alt="" loading="lazy"/>)}
        <span><strong>{rooms.length} room type{rooms.length > 1 ? "s" : ""}</strong>See setups, amenities and rates</span>
      </div>}
      <div className="place-sheet-meta"><span><MapPin/>{place.displayLatitude.toFixed(4)}, {place.displayLongitude.toFixed(4)}</span>{assets.some(a=>a.contentType.startsWith("video/"))&&<span><Play/>Video available</span>}</div><button className="primary-button" onClick={onDirections}><Route/>Get directions<ArrowRight/></button><button className="primary-button" onClick={onOpen}>Explore location<ArrowRight/></button><a className="place-owner-link" href={`/owners?place=${encodeURIComponent(place.id)}`}><BadgeCheck/><span><strong>Own this location?</strong> Claim or manage its profile</span><ArrowRight/></a></div>
  </div>;
}

export function PlaceDetail({ place, media, onBack, onDirections }: { place: Place; media: MediaAsset[]; onBack: () => void; onCommunity: () => void; onDirections: () => void }) {
  const assets = mediaFor(place.photoIds, media); const cover = media.find((asset) => asset.id === place.coverMediaId) || assets.find((asset) => asset.contentType.startsWith("image/")) || firstRoomImage(place, media);
  const galleryIds = place.photoIds.filter((id) => id !== cover?.id);
  const openLightbox = useLightbox();
  const rooms = place.rooms || [];
  const contactActions = placeContactActions(place);
  const [activeRoom, setActiveRoom] = useState<PlaceRoom | null>(null);
  return <section className="place-detail view-enter">
    <div className="place-detail-hero"><img src={cover?.url || pictures.stay} alt={cover?.altText || place.name}/><button className="icon-button back-button" onClick={onBack} aria-label="Back to Municipality Explorer"><ArrowLeft/></button>{cover&&<HeroExpandButton label={`View larger photo of ${place.name}`} onExpand={()=>openLightbox({src:cover.url,alt:cover.altText||place.name,caption:cover.caption})}/>}<div className="place-detail-identity"><p className="eyebrow">{place.type} · {place.barangay}</p><h1>{place.name}</h1></div></div>
    <div className="place-detail-body">
      <button className="primary-button place-directions-button" onClick={onDirections}><Route/>Get walking directions<ArrowRight/></button>
      {contactActions.length>0&&<section className="place-links" aria-label="Book or connect"><p className="eyebrow">Book or connect</p><div className="place-link-pills">{contactActions.map(action=>{const Icon=placeLinkIcon(action.icon);return <a key={action.key} className="place-link-pill" href={action.href} target={action.external?"_blank":undefined} rel={action.external?"noreferrer":undefined} aria-label={action.external?`${action.label} — opens in a new tab`:`Call ${action.label}`}><Icon/><span>{action.label}</span></a>})}</div></section>}
      {rooms.length>0&&<section className="place-rooms" aria-labelledby="place-rooms-heading"><div className="place-rooms-head"><p className="eyebrow">Where you&rsquo;ll sleep</p><h2 id="place-rooms-heading">Rooms &amp; stays</h2><p>{rooms.length} room type{rooms.length>1?"s":""} · tap a room for its photos, setup and amenities.</p></div><div className="room-cards">{rooms.map(room=><RoomCard key={room.id} room={room} media={media} onOpen={()=>setActiveRoom(room)}/>)}</div></section>}
      <section className="place-profile-data" aria-labelledby="place-about-heading"><div className="place-about"><p className="eyebrow" id="place-about-heading">About this place</p><p>{place.description || `A ${place.type.toLowerCase()} in ${place.barangay}, San Vicente.`}</p></div><dl><div><dt>Category</dt><dd>{place.type}</dd></div><div><dt>Barangay</dt><dd>{place.barangay}</dd></div>{place.address&&<div className="place-fact-wide"><dt>Address</dt><dd>{place.address}</dd></div>}{place.verified&&<div><dt>Status</dt><dd><BadgeCheck/>Location verified</dd></div>}</dl></section>
      <MediaGallery ids={place.menuIds} media={media} title="Menu"/>
      {place.proActive&&<p className="eyebrow">Featured · SANVIC Pro</p>}
      {place.ownerDetails&&<section className="place-contact"><h2>At this location</h2>{([['hours','Opening hours'],['amenities','Amenities'],['services','Services & tours'],['offers','Menus, rates, packages & events'],['social','Social links']] as const).map(([key,label])=>place.ownerDetails?.[key]?<div key={key}><h3>{label}</h3><p style={{whiteSpace:'pre-line'}}>{place.ownerDetails[key]}</p></div>:null)}{place.ownerDetails.closure&&place.ownerDetails.closure!=='open'&&<p>{place.ownerDetails.closure==='temporarily_closed'?'Temporarily closed':'Permanently closed'}</p>}</section>}
      <MediaGallery ids={galleryIds} media={media} title={`See ${place.name}`}/>
      {(place.phone || place.website || place.bookingUrl) && <section className="place-contact"><p className="eyebrow">Plan your visit</p><h2>Details from the host.</h2><div className="place-contact-links">{place.phone&&<a href={`tel:${place.phone.replace(/[^\d]/g,"")}`}><Phone/><span><small>Phone</small>{place.phone}</span></a>}{place.website&&<a href={place.website} target="_blank" rel="noreferrer"><Globe2/><span><small>Website</small>{place.website.replace(/^https?:\/\//,"").replace(/\/$/,"")}</span><ExternalLink/></a>}{place.bookingUrl&&<a href={place.bookingUrl} target="_blank" rel="noreferrer"><MapPin/><span><small>Contact or booking</small>Open booking page</span><ArrowRight/></a>}</div></section>}
      <section className="place-owner-callout" aria-labelledby="place-owner-heading"><div><p className="eyebrow">For business owners</p><h2 id="place-owner-heading">Own or manage {place.name}?</h2><p>Claim this profile to update the business description, contact details, map location, photos, videos, services, hours, offers and links.</p></div><div className="place-owner-actions"><a className="primary-button" href={`/owners?place=${encodeURIComponent(place.id)}`}><BadgeCheck/><span>Claim or manage this location</span><ArrowRight/></a><a href={`/owners?place=${encodeURIComponent(place.id)}#pro`}>Feature this location · ₱300/month</a></div></section>
      {rooms.length>0&&<RoomDetail key={activeRoom?.id||"closed"} room={activeRoom||rooms[0]} media={media} open={Boolean(activeRoom)} onOpenChange={open=>{if(!open)setActiveRoom(null)}}/>}
    </div>
  </section>;
}


