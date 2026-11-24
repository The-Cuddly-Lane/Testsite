const CACHE='tcl-v105t1';
const ASSETS=['./','./index.html','./app.js','./manifest.json','./icon-192.png','./theme.css','./polish.css','./nav.js','./motion.js','./safe-write.js','./sync-fast.js','./gcal-bookings.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // Only the same-origin app shell (html/js/css/icons) is cached. Cross-origin requests — the Google Sheets
  // & OAuth API reads — go straight to the network and are NEVER served from cache: caching those returned
  // stale data (a saved edit appeared to revert on re-entry, then "fixed itself" on the next navigation once
  // the background revalidate had refreshed the cache). Bypassing the SW for them keeps reads always live.
  if(new URL(e.request.url).origin!==self.location.origin)return;
  // Network first: with a connection you always get the latest version; the cached copy is only used offline.
  // cache:'no-cache' makes the browser check with GitHub every time instead of reusing its own 10-minute copy,
  // which had served an old app.js next to a new index.html right after an update.
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r&&r.status===200){const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(c=>c||caches.match('./index.html'))));
});
