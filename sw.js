const V='expense-v6';
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(V);await c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png']);for(const u of LIBS){try{await c.add(u)}catch(_){}}self.skipWaiting()})())});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==V)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const same=new URL(e.request.url).origin===location.origin;
  if(same){e.respondWith(fetch(e.request).then(n=>{if(n&&n.ok){const c=n.clone();caches.open(V).then(x=>x.put(e.request,c))}return n}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));return}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n&&(n.ok||n.type==='opaque')){const c=n.clone();caches.open(V).then(x=>x.put(e.request,c))}return n})));
});
