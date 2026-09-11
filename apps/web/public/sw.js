// Minimal offline support: cache the last-seen version of pages and static
// assets the user actually visited, and fall back to it (read-only) when
// there's no network. No background sync, no offline writes - Server
// Actions/API calls (never GET, so already excluded below) simply fail
// offline, same as any other network request would.

const CACHE_NAME = "garmincoach-v1";
const OFFLINE_URL = "/offline";

async function cacheIfOk(cache, request, response) {
  if (response.ok) await cache.put(request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // allSettled, not addAll: one route transiently failing (cold start,
      // brief deploy hiccup) shouldn't block the SW from activating at all.
      .then((cache) => Promise.allSettled([cache.add(OFFLINE_URL), cache.add("/manifest.webmanifest")]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: network-first, cache the response for next time,
  // fall back to the last cached version of that exact page (or the
  // generic offline page) when the network is unavailable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cacheIfOk(cache, request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static assets (icons, CSS, JS chunks, the FIT worker): cache-first,
  // refreshed in the background on every successful fetch.
  if (["style", "script", "image", "font", "worker"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchAndCache = fetch(request)
          .then((response) => {
            caches.open(CACHE_NAME).then((cache) => cacheIfOk(cache, request, response.clone()));
            return response;
          })
          .catch(() => cached);
        return cached ?? fetchAndCache;
      }),
    );
  }
});
