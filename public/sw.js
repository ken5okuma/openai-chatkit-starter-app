const CACHE = "voice-translator-v1";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
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
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (
              res.ok &&
              (url.pathname === "/" ||
                url.pathname.startsWith("/icons/") ||
                url.pathname.endsWith(".webmanifest"))
            ) {
              const clone = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached as Response)
    )
  );
});
