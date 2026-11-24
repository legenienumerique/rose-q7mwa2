/* La dernière rose : garde la page dans le téléphone pour qu'elle s'ouvre même sans réseau.
   La page est toujours redemandée au réseau d'abord (les mises à jour arrivent tout de suite).
   La musique et les vidéos passent par le réseau (trop lourdes, et lues par morceaux). */
const V = 'rose-v1', POLICES = 'rose-polices';
const COQUILLE = ['./', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('rose-') && k !== V && k !== POLICES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const delai = (p, ms) => new Promise((ok, non) => { const t = setTimeout(() => non(new Error('lent')), ms); p.then(r => { clearTimeout(t); ok(r); }, x => { clearTimeout(t); non(x); }); });

self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);

  // Polices Google : gardées une fois pour toutes
  if(u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open(POLICES).then(async c => {
      const hit = await c.match(r); if(hit) return hit;
      const res = await fetch(r); if(res.ok || res.type === 'opaque') c.put(r, res.clone()); return res;
    }));
    return;
  }
  if(u.origin !== location.origin || !u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if(/\.(mp3|mp4|m4a|ics)$/i.test(u.pathname)) return;
  // Seul le conte lui-même est gardé : la vieille adresse /grimoire/ (redirection) passe par le réseau
  const racine = new URL('./', self.registration.scope).pathname;
  if(u.pathname.startsWith(racine + 'grimoire')) return;

  // La page : réseau d'abord (8 s max), sinon la dernière copie
  if(u.pathname === racine || u.pathname === racine + 'index.html'){
    e.respondWith((async () => {
      const c = await caches.open(V);
      try{
        const res = await delai(fetch(r), 8000);
        if(res.ok) c.put('./', res.clone());
        return res;
      }catch(x){
        return (await c.match('./')) || (await c.match(r, {ignoreSearch:true})) || Response.error();
      }
    })());
    return;
  }
  // Le reste (icônes, manifeste) : la copie gardée, sinon le réseau
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(r, {ignoreSearch:true}); if(hit) return hit;
    const res = await fetch(r); if(res.ok) c.put(r, res.clone()); return res;
  }));
});
