/* SM Shahid Shah member PWA: scope /app/ only.
   No authenticated pages, Supabase responses, news, or other personal data are cached. */
const CACHE = "sm-member-offline-v1";
const OFFLINE = "/app/offline.html";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("sm-member-offline-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/app/")) return;
  event.respondWith(fetch(request).catch(async () => (
    await caches.match(OFFLINE) ||
    new Response("You are offline. Reconnect to access your workspace.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  )));
});
