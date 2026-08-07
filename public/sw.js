// Cache-first para os arquivos estáticos gerados pelo build (JS/CSS/imagens),
// que já têm hash no nome do arquivo (mudam de nome a cada novo build).
// index.html sempre vai à rede (network-first) para garantir que o usuário
// pegue a versão mais nova do app, mas os assets pesados ficam no cache do
// aparelho e não precisam ser baixados de novo a cada abertura.
const CACHE_NAME = 'zd-assets-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // index.html e navegações: sempre rede primeiro, cache só como fallback offline
  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Assets versionados (/assets/...): cache primeiro, já que o nome muda a cada build
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }
});
