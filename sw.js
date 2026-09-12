const CACHE='fluid-log-v4';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(ASSETS.map(async path=>{
    // Bypass the HTTP cache so a newly installed worker cannot precache old files.
    const response=await fetch(new Request(path,{cache:'reload'}));
    if(!response.ok)throw new Error(`Unable to cache ${path}`);
    await cache.put(path,response);
  }));
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('fluid-log-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      // The network wins when available; the last working copy remains offline.
      const response=await fetch(new Request(request,{cache:'no-store'}));
      if(response.ok){
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
      }
      return response;
    }catch{
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
      return Response.error();
    }
  })());
});
