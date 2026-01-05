

const APP_SHELL = [
  "/",
  "/index.html",
  "/antrim.html",
  "/armagh.html",
  "/derry.html",
  "/down.html",
  "/fermanagh.html",
  "/tyrone.html",
  "/contact.html",
  "/submit.html",
  "/privacy.html",
  "/assets/app.js",
  "/assets/style.css",
  "/data/events.json",
  "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // HTML pages → network first
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // events.json → stale while revalidate
  if (req.url.includes("/data/events.json")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // everything else → cache first
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return await cache.match(req);
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const networkFetch = fetch(req).then(res => {
    cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  return cached || networkFetch;
}