const CACHE = "fueled-v2";

/** Nie precachujemy stron HTML — middleware robi redirecty (login/app), co psuje Safari iOS. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* Safari: nigdy nie przechwytuj nawigacji — unikamy „Response served by service worker has redirections”. */
  if (request.mode === "navigate") return;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (
          response.ok &&
          /\.(png|jpg|jpeg|webp|ico|svg|woff2?)$/i.test(url.pathname)
        ) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
