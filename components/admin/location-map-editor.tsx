'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { Crosshair } from 'lucide-react';

const PALAWAN_BOUNDS: [[number, number], [number, number]] = [[7.72, 117.72], [12.38, 120.28]];

export default function LocationMapEditor({ latitude, longitude, onChange }: { latitude: number; longitude: number; onChange: (latitude: number, longitude: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let cancelled = false; let cleanup = () => {};
    (async () => {
      const leaflet = await import('leaflet'); const L = leaflet.default; if (cancelled || !host.current) return;
      const map = L.map(host.current, { center: [latitude, longitude], zoom: 14, zoomControl: true, attributionControl: true, maxBounds: PALAWAN_BOUNDS, maxBoundsViscosity: 1, minZoom: 6, maxZoom: 19 });
      map.attributionControl.setPrefix(false);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Vantor, Earthstar Geographics, GIS Community' }).addTo(map);
      const icon = L.divIcon({ className: 'admin-map-marker', html: '<span></span>', iconSize: [34, 42], iconAnchor: [17, 40] });
      const marker = L.marker([latitude, longitude], { icon, draggable: true, keyboard: true, title: 'Drag to correct the SANVIC marker' }).addTo(map);
      marker.on('dragend', () => { const point = marker.getLatLng(); changeRef.current(Number(point.lat.toFixed(6)), Number(point.lng.toFixed(6))); });
      mapRef.current = map; markerRef.current = marker;
      cleanup = () => { marker.remove(); map.remove(); mapRef.current = null; markerRef.current = null; };
    })();
    return () => { cancelled = true; cleanup(); };
  }, []);

  useEffect(() => { const marker = markerRef.current; const map = mapRef.current; if (!marker || !map) return; const point = marker.getLatLng(); if (Math.abs(point.lat - latitude) > 0.000001 || Math.abs(point.lng - longitude) > 0.000001) { marker.setLatLng([latitude, longitude]); map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), { duration: 0.35 }); } }, [latitude, longitude]);

  return <section className="admin-location-map"><div className="admin-map-heading"><div><p className="admin-kicker">SANVIC map position</p><h3>Confirm the exact marker</h3></div><span><Crosshair/>Drag the marker to correct it</span></div><div ref={host} className="admin-map-canvas"/><p>The Google Maps link is only the source. This marker is what visitors see inside SANVIC.</p></section>;
}
