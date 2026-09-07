'use client';

import { Layers3, LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LatLngExpression } from 'leaflet';

const PALAWAN_BOUNDS: [[number, number], [number, number]] = [[7.72, 117.72], [12.38, 120.28]];

export default function LocationMiniMap({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const mapActions=useRef<{setLayer:(layer:Basemap)=>void;locate:()=>void}>({setLayer:()=>{},locate:()=>{}});
  const [basemap,setBasemap]=useState<Basemap>('dark'); const [locationState,setLocationState]=useState<'idle'|'locating'|'tracking'|'error'>('idle');
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false; let cleanup = () => {};
    (async () => {
      const leaflet = await import('leaflet'); const L = leaflet.default; if (cancelled || !host.current) return;
      const map = L.map(host.current, { center: [latitude, longitude], zoom: 14, zoomControl: true, attributionControl: true, maxBounds: PALAWAN_BOUNDS, maxBoundsViscosity: 1, minZoom: 6, maxZoom: 19, zoomSnap:.25, wheelPxPerZoomLevel:80 });
      map.attributionControl.setPrefix(false);
      const tiles:Record<Basemap,ReturnType<typeof L.tileLayer>>={street:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}),dark:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{className:'dark-map-tiles',maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}),satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri, Vantor, Earthstar Geographics, GIS Community'})};
      tiles.dark.addTo(map);
      const icon = L.divIcon({ className: 'place-map-marker', html: '<span></span>', iconSize: [32, 38], iconAnchor: [16, 36] });
      L.marker([latitude, longitude], { icon, keyboard: true, title: name }).bindPopup(name).addTo(map).openPopup();
      let userMarker:ReturnType<typeof L.marker>|null=null,accuracyCircle:ReturnType<typeof L.circle>|null=null,watchId:number|null=null;
      mapActions.current.setLayer=(next)=>{(Object.keys(tiles) as Basemap[]).forEach(key=>{if(map.hasLayer(tiles[key]))map.removeLayer(tiles[key])});tiles[next].addTo(map);tiles[next].bringToBack()};
      mapActions.current.locate=()=>{if(!navigator.geolocation){setLocationState('error');return}if(userMarker){map.flyTo(userMarker.getLatLng(),Math.max(map.getZoom(),15),{duration:.4});return}if(watchId!==null)return;setLocationState('locating');watchId=navigator.geolocation.watchPosition(({coords})=>{const point:LatLngExpression=[coords.latitude,coords.longitude];if(!userMarker){const userIcon=L.divIcon({className:'sanvic-user-marker',html:'<span><i></i></span>',iconSize:[30,30],iconAnchor:[15,15]});userMarker=L.marker(point,{icon:userIcon,interactive:true,zIndexOffset:1000,title:'You are here'}).bindTooltip('You are here',{direction:'top',offset:[0,-12]}).addTo(map);accuracyCircle=L.circle(point,{radius:coords.accuracy,color:'#fff7e8',weight:1,opacity:.65,fillColor:'#4c9f86',fillOpacity:.14,interactive:false}).addTo(map);map.flyTo(point,Math.max(map.getZoom(),15),{duration:.45})}else{userMarker.setLatLng(point);accuracyCircle?.setLatLng(point).setRadius(coords.accuracy)}setLocationState('tracking')},()=>{watchId=null;setLocationState('error')},{enableHighAccuracy:true,maximumAge:10000,timeout:15000})};
      cleanup = () => {if(watchId!==null)navigator.geolocation.clearWatch(watchId);mapActions.current={setLayer:()=>{},locate:()=>{}};map.remove()};
    })();
    return () => { cancelled = true; cleanup(); };
  }, [latitude, longitude, name]);
  const choose=(next:Basemap)=>{setBasemap(next);mapActions.current.setLayer(next)};
  return <div className="place-mini-map-wrap"><div ref={host} className="place-mini-map" aria-label={`Interactive SANVIC map showing ${name}`}/><div className="mini-map-layers" role="group" aria-label="Location map appearance"><span><Layers3/>Map</span>{(['street','dark','satellite'] as Basemap[]).map(mode=><button key={mode} className={basemap===mode?'active':''} onClick={()=>choose(mode)} aria-pressed={basemap===mode}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}</div><button className={`mini-map-locate ${locationState==='tracking'?'active':''}`} onClick={()=>mapActions.current.locate()} aria-label="Show your location on this map"><LocateFixed/><span>{locationState==='locating'?'Finding…':locationState==='tracking'?'You are here':'My location'}</span></button>{locationState==='error'&&<div className="mini-map-error">Allow location access to show where you are.</div>}</div>;
}

type Basemap='street'|'dark'|'satellite';
