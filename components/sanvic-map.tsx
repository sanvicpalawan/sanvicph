'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import { Compass, Layers3, LocateFixed, Minus, Plus } from 'lucide-react';
import type { Community } from '@/lib/sanvic-data';
import type { Place } from '@/lib/cms-types';

type Basemap = 'street' | 'dark' | 'satellite';
const PALAWAN_BOUNDS: [[number, number], [number, number]] = [[7.72, 117.72], [12.38, 120.28]];
const SAN_VICENTE_BOUNDS: [[number, number], [number, number]] = [[10.20, 118.92], [10.83, 119.43]];
const safe = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
const markerClass = (type: string) => type.toLowerCase().replace(/[^a-z]+/g, '-');

export default function SanvicMap({ active, activePlace, onSelect, communities, places, onPlaceSelect }: { active: Community | null; activePlace: Place | null; onSelect: (community: Community) => void; communities: Community[]; places: Place[]; onPlaceSelect: (place: Place) => void; copy?: Record<string, string> }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<Record<Basemap, TileLayer> | null>(null);
  const callbacks = useRef({ active, activePlace, onSelect, onPlaceSelect, communities, places });
  const redraw = useRef<() => void>(() => {});
  const [basemap, setBasemap] = useState<Basemap>('satellite');
  const [ready, setReady] = useState(false);

  useEffect(() => { callbacks.current = { active, activePlace, onSelect, onPlaceSelect, communities, places }; redraw.current(); }, [active, activePlace, onSelect, onPlaceSelect, communities, places]);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet.markercluster');
      const L = leaflet.default;
      if (cancelled || !host.current) return;
      const map = L.map(host.current, { zoomControl: false, attributionControl: true, maxBounds: PALAWAN_BOUNDS, maxBoundsViscosity: 1, minZoom: 6, maxZoom: 19, worldCopyJump: false, zoomSnap: 0.25, wheelPxPerZoomLevel: 90 });
      map.attributionControl.setPrefix(false);
      const tiles: Record<Basemap, TileLayer> = {
        street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }),
        dark: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { className: 'dark-map-tiles', maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Vantor, Earthstar Geographics, GIS Community' }),
      };
      tiles.satellite.addTo(map);
      tilesRef.current = tiles;
      map.fitBounds(SAN_VICENTE_BOUNDS, { paddingTopLeft: [24, 100], paddingBottomRight: [24, 160], animate: false });
      map.setMinZoom(map.getBoundsZoom(PALAWAN_BOUNDS, false, L.point(24, 24)));

      const communityLabels = L.layerGroup().addTo(map);
      const locationClusters = L.markerClusterGroup({
        maxClusterRadius: 46,
        disableClusteringAtZoom: 14,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => L.divIcon({ className: 'sanvic-cluster', html: `<span>${cluster.getChildCount()}</span>`, iconSize: [38, 38] }),
      }).addTo(map);
      let boundaries: ReturnType<typeof L.geoJSON> | null = null;

      const draw = () => {
        const current = callbacks.current;
        communityLabels.clearLayers();
        current.communities.forEach((community) => {
          const label = L.marker([community.lat, community.lon], { interactive: true, keyboard: true, title: `Explore ${community.name}`, icon: L.divIcon({ className: 'community-map-label', html: `<span>${safe(community.name)}</span>`, iconSize: [130, 34], iconAnchor: [65, 17] }) });
          label.on('click', () => current.onSelect(community));
          communityLabels.addLayer(label);
        });
        if (boundaries) boundaries.setStyle((feature) => ({ color: feature?.properties?.name === current.active?.boundary ? '#8fd0b3' : '#c3a474', weight: feature?.properties?.name === current.active?.boundary ? 2 : 1, opacity: feature?.properties?.name === current.active?.boundary ? 0.9 : 0.48, fillColor: '#348d70', fillOpacity: feature?.properties?.name === current.active?.boundary ? 0.2 : 0.025 }));
        locationClusters.clearLayers();
        current.places.forEach((place) => {
          const selected = place.id === current.activePlace?.id;
          const marker = L.marker([place.displayLatitude, place.displayLongitude], { keyboard: true, title: place.name, icon: L.divIcon({ className: 'sanvic-location-marker', html: `<span class="location-map-dot type-${markerClass(place.type)} ${selected ? 'selected' : ''}"></span>`, iconSize: [32, 32], iconAnchor: [16, 16] }) });
          marker.bindTooltip(place.name, { direction: 'top', offset: [0, -10], opacity: 0.96, permanent: selected, className: 'sanvic-location-tooltip' });
          marker.on('click', () => current.onPlaceSelect(place));
          locationClusters.addLayer(marker);
        });
      };
      redraw.current = draw;
      const response = await fetch('/communities.geojson');
      if (response.ok) {
        const geojson = await response.json();
        boundaries = L.geoJSON(geojson, {
          style: () => ({ color: '#c3a474', weight: 1, opacity: 0.48, fillColor: '#348d70', fillOpacity: 0.025 }),
          onEachFeature: (feature, layer) => layer.on('click', () => { const match = callbacks.current.communities.find((community) => community.boundary === feature.properties?.name); if (match) callbacks.current.onSelect(match); }),
        }).addTo(map);
      }
      const scaleLabels = () => host.current?.classList.toggle('palawan-scale', map.getZoom() < 8.25);
      map.on('zoomend', scaleLabels); scaleLabels(); draw();
      mapRef.current = map; setReady(true);
      cleanup = () => { redraw.current = () => {}; map.remove(); mapRef.current = null; tilesRef.current = null; };
    })();
    return () => { cancelled = true; cleanup(); };
  }, []);

  useEffect(() => {
    const map = mapRef.current; const tiles = tilesRef.current; if (!map || !tiles || !ready) return;
    (Object.keys(tiles) as Basemap[]).forEach((name) => { if (map.hasLayer(tiles[name])) map.removeLayer(tiles[name]); });
    tiles[basemap].addTo(map); tiles[basemap].bringToBack();
  }, [basemap, ready]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    if (activePlace) map.flyTo([activePlace.displayLatitude, activePlace.displayLongitude], Math.max(map.getZoom(), 15), { duration: 0.45 });
    else if (active) map.flyTo([active.lat, active.lon], Math.max(map.getZoom(), 11.5), { duration: 0.45 });
  }, [active, activePlace, ready]);

  const resetSanVicente = () => mapRef.current?.fitBounds(SAN_VICENTE_BOUNDS, { paddingTopLeft: [24, 100], paddingBottomRight: [24, 160], duration: 0.45 });
  const showPalawan = () => mapRef.current?.fitBounds(PALAWAN_BOUNDS, { padding: [18, 18], duration: 0.5 });

  return <section className="explorer view-enter" aria-label="Municipality Explorer">
    <div className="map-canvas" ref={host}/>
    <div className="map-layer-switch" role="group" aria-label="Map appearance"><span><Layers3/>Map</span>{(['street', 'dark', 'satellite'] as Basemap[]).map((mode) => <button key={mode} className={basemap === mode ? 'active' : ''} onClick={() => setBasemap(mode)} aria-pressed={basemap === mode}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
    <div className="map-tools"><button className="icon-button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><Plus/></button><button className="icon-button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><Minus/></button><button className="icon-button" onClick={resetSanVicente} aria-label="Return to San Vicente"><LocateFixed/></button></div>
    <button className="palawan-view" onClick={showPalawan}><Compass/>View all Palawan</button>
    <div className="community-rail"><div className="rail-handle"/><div className="rail-title"><p className="eyebrow">San Vicente communities</p><span>{places.length} locations</span></div><nav aria-label="Coastal communities">{communities.map((community) => <button key={community.id} className={active?.id === community.id ? 'active' : ''} onClick={() => onSelect(community)}><span>{community.name}</span></button>)}</nav></div>
  </section>;
}
