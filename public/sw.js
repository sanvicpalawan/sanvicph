const CACHE='sanvic-assets-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sanvic-assets-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Only cache public static assets. Private HTML and authentication remain network-only.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||!/^\/(images|fonts|icons)\//.test(url.pathname))return;event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(event.request);if(hit)return hit;const response=await fetch(event.request);if(response.ok&&response.type==='basic')cache.put(event.request,response.clone());return response}))});
