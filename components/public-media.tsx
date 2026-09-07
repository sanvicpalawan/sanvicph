"use client";

import { ArrowLeft, ArrowRight, Copy, MapPin, Play, Waves } from "lucide-react";
import type { MediaAsset, Place } from "@/lib/cms-types";
import { pictures } from "@/lib/sanvic-data";
import LocationMiniMap from "@/components/location-mini-map";

export function mediaFor(ids: string[] | undefined, media: MediaAsset[]) {
  const wanted = new Set(ids || []);
  return media.filter((asset) => wanted.has(asset.id));
}

export function MediaGallery({ ids, media, title = "In this story", compact = false }: { ids?: string[]; media: MediaAsset[]; title?: string; compact?: boolean }) {
  const assets = mediaFor(ids, media);
  if (!assets.length) return null;
  return <section className={`public-media-gallery ${compact ? "compact" : ""}`}>
    <div className="public-media-heading"><p className="eyebrow">Photos & video</p><h2>{title}</h2></div>
    <div className="public-media-grid">{assets.map((asset) => <figure key={asset.id}>
      {asset.contentType.startsWith("video/") ? <div className="public-video"><video controls playsInline preload="metadata" src={asset.url}/><span><Play/>Video</span></div> : <img src={asset.url} alt={asset.altText || asset.caption || ""} loading="lazy"/>}
      {(asset.caption || asset.altText) && <figcaption>{asset.caption || asset.altText}</figcaption>}
    </figure>)}</div>
  </section>;
}

export function PlaceCard({ place, media, onOpen }: { place: Place; media: MediaAsset[]; onOpen: () => void }) {
  const cover = media.find((asset) => asset.id === place.coverMediaId) || mediaFor(place.photoIds, media).find((asset) => asset.contentType.startsWith("image/"));
  return <article className="place-card">
    <button className="place-card-photo" onClick={onOpen} aria-label={`Explore ${place.name} in SANVIC`}><img src={cover?.url || pictures.stay} alt={cover?.altText || ""} loading="lazy"/></button>
    <div><p className="eyebrow">{place.type} · {place.barangay}</p><h3>{place.name}</h3><p>{place.description || place.address}</p><button className="place-card-open" onClick={onOpen}><MapPin/>Explore here in SANVIC<ArrowRight/></button></div>
  </article>;
}

export function PlaceSheet({ place, media, onOpen }: { place: Place; media: MediaAsset[]; onOpen: () => void }) {
  const assets = mediaFor(place.photoIds, media); const cover = media.find((asset) => asset.id === place.coverMediaId) || assets.find((asset) => asset.contentType.startsWith("image/"));
  return <div className="place-sheet-inner">
    <div className="place-sheet-cover">{cover ? <img src={cover.url} alt={cover.altText || ""}/> : <img src={pictures.stay} alt=""/>}<span><MapPin/>{place.type}</span></div>
    <div className="place-sheet-copy"><p className="eyebrow">{place.barangay} · San Vicente</p><h2>{place.name}</h2><p>{place.description || place.address}</p><div className="place-sheet-meta"><span><MapPin/>{place.displayLatitude.toFixed(4)}, {place.displayLongitude.toFixed(4)}</span>{assets.some(a=>a.contentType.startsWith("video/"))&&<span><Play/>Video available</span>}</div><button className="primary-button" onClick={onOpen}>Explore location<ArrowRight/></button></div>
  </div>;
}

export function PlaceDetail({ place, media, onBack, onCommunity }: { place: Place; media: MediaAsset[]; onBack: () => void; onCommunity: () => void }) {
  const assets = mediaFor(place.photoIds, media); const cover = media.find((asset) => asset.id === place.coverMediaId) || assets.find((asset) => asset.contentType.startsWith("image/"));
  const copyCoordinates = async () => { try { await navigator.clipboard.writeText(`${place.displayLatitude}, ${place.displayLongitude}`); } catch {} };
  return <section className="place-detail view-enter">
    <div className="place-detail-hero"><img src={cover?.url || pictures.stay} alt={cover?.altText || ""}/><button className="icon-button back-button" onClick={onBack} aria-label="Back to Municipality Explorer"><ArrowLeft/></button><div><p className="eyebrow">{place.type} · {place.barangay}</p><h1>{place.name}</h1><p>{place.description || place.address}</p></div></div>
    <div className="place-detail-body"><section className="place-location-panel"><LocationMiniMap latitude={place.displayLatitude} longitude={place.displayLongitude} name={place.name}/><div><p className="eyebrow">Location</p><h2>Here in {place.barangay}.</h2><p>{place.address || `${place.barangay}, San Vicente, Palawan`}</p><div className="place-coordinate"><MapPin/><span>{place.displayLatitude.toFixed(5)}° N<br/>{place.displayLongitude.toFixed(5)}° E</span></div><button onClick={copyCoordinates}><Copy/>Copy coordinates</button><button onClick={onCommunity}><Waves/>Explore {place.barangay}</button></div></section>
      <MediaGallery ids={place.photoIds} media={media} title={`See ${place.name}`}/>
      {(place.phone || place.website || place.bookingUrl) && <section className="place-contact"><p className="eyebrow">Plan your visit</p><h2>Details from the host.</h2>{place.phone&&<p>{place.phone}</p>}{place.website&&<p>{place.website.replace(/^https?:\/\//, "")}</p>}{place.bookingUrl&&<a href={place.bookingUrl} target="_blank" rel="noreferrer">Contact or book<ArrowRight/></a>}</section>}
    </div>
  </section>;
}
