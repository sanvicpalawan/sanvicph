'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLngExpression, Map as LeafletMap, TileLayer } from 'leaflet';
import { Compass, Layers3, LocateFixed, MapPinned, Minus, Plus } from 'lucide-react';
import type { Community } from '@/lib/sanvic-data';
import type { Place } from '@/lib/cms-types';

type Basemap = 'street' | 'dark' | 'satellite';
type MapView = 'palawan' | 'communities' | 'locations';
const PALAWAN_BOUNDS: [[number, number], [number, number]] = [[7.72, 117.72], [12.38, 120.28]];
const SAN_VICENTE_BOUNDS: [[number, number], [number, number]] = [[10.20, 118.92], [10.83, 119.43]];
const SAN_VICENTE_CENTER: LatLngExpression = [10.52, 119.18];
const safe = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
const markerClass = (type: string) => type.toLowerCase().replace(/[^a-z]+/g, '-');

export default function SanvicMap({ active, activePlace, onSelect, communities, places, onPlaceSelect }: { active: Community | null; activePlace: Place | null; onSelect: (community: Community) => void; communities: Community[]; places: Place[]; onPlaceSelect: (place: Place) => void; copy?: Record<string, string> }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<Record<Basemap, TileLayer> | null>(null);
  const callbacks = useRef({ active, activePlace, onSelect, onPlaceSelect, communities, places });
  const redraw = useRef<() => void>(() => {});
  const locateUser = useRef<() => void>(() => {});
  const [basemap, setBasemap] = useState<Basemap>('satellite');
  const [mapView, setMapView] = useState<MapView>('communities');
  const [ready, setReady] = useState(false);
  const [locationState, setLocationState] = useState<'idle'|'locating'|'tracking'|'error'>('idle');

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
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 17, attribution: 'Esri, Vantor, Earthstar Geographics, GIS Community' }),
      };
      tiles.satellite.addTo(map);
      tilesRef.current = tiles;
      map.fitBounds(SAN_VICENTE_BOUNDS, { paddingTopLeft: [24, 100], paddingBottomRight: [24, 160], animate: false });
      map.setMinZoom(map.getBoundsZoom(PALAWAN_BOUNDS, false, L.point(24, 24)));

      const municipalityLabel = L.layerGroup();
      const communityLabels = L.layerGroup();
      const locationClusters = L.markerClusterGroup({
        maxClusterRadius: 54,
        disableClusteringAtZoom: 14,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => L.divIcon({ className: 'sanvic-cluster', html: `<span>${cluster.getChildCount()}</span>`, iconSize: [38, 38] }),
      });
      let boundaries: ReturnType<typeof L.geoJSON> | null = null;
      let userMarker: ReturnType<typeof L.marker> | null = null; let accuracyCircle: ReturnType<typeof L.circle> | null = null; let watchId:number|null = null;

      locateUser.current = () => {
        if (!navigator.geolocation) { setLocationState('error'); return; }
        if (userMarker) { map.flyTo(userMarker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.4 }); return; }
        if (watchId !== null) return;
        setLocationState('locating');
        watchId = navigator.geolocation.watchPosition(({coords}) => {
          const point:LatLngExpression = [coords.latitude, coords.longitude];
          if (!userMarker) {
            const icon=L.divIcon({className:'sanvic-user-marker',html:'<span><i></i></span>',iconSize:[30,30],iconAnchor:[15,15]});
            userMarker=L.marker(point,{icon,keyboard:false,interactive:true,zIndexOffset:1000,title:'You are here'}).bindTooltip('You are here',{direction:'top',offset:[0,-12],className:'sanvic-location-tooltip'}).addTo(map);
            accuracyCircle=L.circle(point,{radius:coords.accuracy,color:'#fff7e8',weight:1,opacity:.65,fillColor:'#4c9f86',fillOpacity:.14,interactive:false}).addTo(map);
            map.flyTo(point,Math.max(map.getZoom(),15),{duration:.45});
          } else { userMarker.setLatLng(point); accuracyCircle?.setLatLng(point).setRadius(coords.accuracy); }
          setLocationState('tracking');
        },()=>{watchId=null;setLocationState('error')},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
      };

      const draw = () => {
        const current = callbacks.current;
        communityLabels.clearLayers();
        current.communities.forEach((community) => {
          const label = L.marker([community.lat, community.lon], { interactive: true, keyboard: true, title: `Explore ${community.name}`, icon: L.divIcon({ className: `community-map-label community-label-${community.id}`, html: `<span>${safe(community.name)}</span>`, iconSize: [130, 34], iconAnchor: [65, 17] }) });
          label.on('click', () => current.onSelect(community));
          communityLabels.addLayer(label);
        });
        if (boundaries) boundaries.setStyle((feature) => { const name = (feature?.properties as { name?: string } | undefined)?.name; return { color: name === current.active?.boundary ? '#8fd0b3' : '#c3a474', weight: name === current.active?.boundary ? 2 : 1, opacity: name === current.active?.boundary ? 0.9 : 0.48, fillColor: '#348d70', fillOpacity: name === current.active?.boundary ? 0.2 : 0.025 }; });
        locationClusters.clearLayers();
        current.places.forEach((place) => {
          const selected = place.id === current.activePlace?.id;
          const marker = L.marker([place.displayLatitude, place.displayLongitude], { keyboard: true, title: place.name, icon: L.divIcon({ className: 'sanvic-location-marker', html: `<span class="location-map-dot type-${markerClass(place.type)} ${selected ? 'selected' : ''} ${place.proActive ? 'pro-featured' : ''}"></span>`, iconSize: [32, 32], iconAnchor: [16, 16] }) });
          marker.bindTooltip(`${safe(place.name)}${place.proActive ? ' · Featured' : ''}`, { direction: 'top', offset: [0, -10], opacity: 0.96, permanent: selected, className: 'sanvic-location-tooltip' });
          marker.on('click', () => current.onPlaceSelect(place));
          locationClusters.addLayer(marker);
        });
      };
      redraw.current = draw;
      const municipalityMarker = L.marker(SAN_VICENTE_CENTER, {
        interactive: true,
        keyboard: true,
        title: 'Return to San Vicente',
        icon: L.divIcon({ className: 'municipality-map-label', html: '<span><strong>San Vicente</strong><small>Explore 10 communities</small></span>', iconSize: [170, 58], iconAnchor: [85, 29] }),
      });
      municipalityMarker.on('click', () => map.fitBounds(SAN_VICENTE_BOUNDS, { padding: [36, 84], duration: 0.45 }));
      municipalityLabel.addLayer(municipalityMarker);
      const response = await fetch('/communities.geojson');
      if (response.ok) {
        const geojson = await response.json();
        boundaries = L.geoJSON(geojson, {
          style: () => ({ color: '#c3a474', weight: 1, opacity: 0.48, fillColor: '#348d70', fillOpacity: 0.025 }),
          onEachFeature: (feature, layer) => layer.on('click', () => { const boundaryName = (feature.properties as { name?: string } | undefined)?.name; const match = callbacks.current.communities.find((community) => community.boundary === boundaryName); if (match) callbacks.current.onSelect(match); }),
        });
      }
      const applyZoomLevel = () => {
        const zoom = map.getZoom();
        const nextView: MapView = zoom < 8.75 ? 'palawan' : zoom < 12 ? 'communities' : 'locations';
        setMapView(nextView);
        host.current?.setAttribute('data-map-view', nextView);
        const showOnly = (layer: ReturnType<typeof L.layerGroup> | typeof locationClusters, visible: boolean) => {
          if (visible && !map.hasLayer(layer)) layer.addTo(map);
          if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
        };
        showOnly(municipalityLabel, nextView === 'palawan');
        showOnly(communityLabels, nextView === 'communities');
        showOnly(locationClusters, nextView === 'locations');
        if (boundaries) showOnly(boundaries, nextView !== 'palawan');
      };
      map.on('zoomend', applyZoomLevel);
      draw(); applyZoomLevel();
      mapRef.current = map; setReady(true);
      cleanup = () => { if(watchId!==null)navigator.geolocation.clearWatch(watchId);locateUser.current=()=>{};redraw.current = () => {}; map.remove(); mapRef.current = null; tilesRef.current = null; };
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
    else if (active) map.flyTo([active.lat, active.lon], Math.max(map.getZoom(), 12.5), { duration: 0.45 });
  }, [active, activePlace, ready]);

  const resetSanVicente = () => mapRef.current?.fitBounds(SAN_VICENTE_BOUNDS, { paddingTopLeft: [32, 104], paddingBottomRight: [32, 150], duration: 0.45 });
  const showPalawan = () => mapRef.current?.fitBounds(PALAWAN_BOUNDS, { padding: [18, 18], duration: 0.5 });

  return <section className="explorer view-enter" aria-label="Municipality Explorer">
    <div className="map-canvas" ref={host}/>
    <div className="map-layer-switch" role="group" aria-label="Map appearance"><span><Layers3/>Map</span>{(['street', 'dark', 'satellite'] as Basemap[]).map((mode) => <button key={mode} className={basemap === mode ? 'active' : ''} onClick={() => setBasemap(mode)} aria-pressed={basemap === mode}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
    <div className="map-tools"><button className="icon-button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><Plus/></button><button className="icon-button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><Minus/></button><button className={`icon-button map-user-location ${locationState==='tracking'?'active':''}`} onClick={()=>locateUser.current()} aria-label={locationState==='tracking'?'Center map on your location':'Show your location'} aria-pressed={locationState==='tracking'}><LocateFixed/></button></div>
    {locationState==='locating'&&<div className="map-location-status">Finding your location…</div>}{locationState==='error'&&<div className="map-location-status error">Location unavailable. Allow location access and try again.</div>}
    {mapView !== 'palawan'&&<button className="palawan-view" onClick={showPalawan}><Compass/>View Palawan</button>}
    <div className={`community-rail ${mapView === 'palawan' ? 'regional' : ''}`}><div className="rail-handle"/><div className="rail-title"><p className="eyebrow">{mapView === 'palawan' ? 'San Vicente, Palawan' : mapView === 'locations' ? 'Explore locations' : 'San Vicente communities'}</p><span>{places.length} locations</span></div>{mapView === 'palawan' ? <button className="rail-return" onClick={resetSanVicente}><MapPinned/><span><strong>Return to San Vicente</strong><small>10 coastal communities</small></span></button> : <nav aria-label="Coastal communities">{communities.map((community) => <button key={community.id} className={active?.id === community.id ? 'active' : ''} onClick={() => onSelect(community)}><span>{community.name}</span></button>)}</nav>}</div>
  </section>;
}
