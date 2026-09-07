'use client';

import { useEffect, useRef } from 'react';

const PALAWAN_BOUNDS: [[number, number], [number, number]] = [[7.72, 117.72], [12.38, 120.28]];

export default function LocationMiniMap({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false; let cleanup = () => {};
    (async () => {
      const leaflet = await import('leaflet'); const L = leaflet.default; if (cancelled || !host.current) return;
      const map = L.map(host.current, { center: [latitude, longitude], zoom: 14, zoomControl: true, attributionControl: true, maxBounds: PALAWAN_BOUNDS, maxBoundsViscosity: 1, minZoom: 6, maxZoom: 18 });
      map.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { className: 'dark-map-tiles', maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const icon = L.divIcon({ className: 'place-map-marker', html: '<span></span>', iconSize: [32, 38], iconAnchor: [16, 36] });
      L.marker([latitude, longitude], { icon, keyboard: true, title: name }).bindPopup(name).addTo(map).openPopup();
      cleanup = () => map.remove();
    })();
    return () => { cancelled = true; cleanup(); };
  }, [latitude, longitude, name]);
  return <div ref={host} className="place-mini-map" role="img" aria-label={`Interactive SANVIC map showing ${name}`}/>;
}
