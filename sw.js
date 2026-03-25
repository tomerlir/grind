// GRIND — Service Worker
// Cache-first strategy for the app shell.
// n8n webhook calls and Google Fonts CSS are never cached here
// (fonts are cached naturally on first fetch by the cache handler below).

const CACHE = "grind-beta-v1.5";
const ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/vendor/howler.min.js",
  "/sounds.js",
  "/manifest.json",
  "/icons/site.webmanifest",
  "/icons/web-app-manifest-192x192.png",
  "/icons/web-app-manifest-512x512.png",
  "/sounds/pull-start.mp3",
  "/sounds/spinning-loop.mp3",
  "/sounds/reel-lock.mp3",
  "/sounds/final-lock.mp3",
  "/sounds/set-logged.mp3",
  "/sounds/level-up.mp3",
  "/sounds/workout-complete.mp3",
  "/sounds/card-tap.mp3",
  "/sounds/navigate-back.mp3",
  "/sounds/rest-timer-end.mp3",
];

// Install: pre-cache app shell
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))),
);

// Activate: delete stale caches from previous versions
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

// Fetch: cache-first for everything except the n8n webhook
self.addEventListener("fetch", (e) => {
  // Never intercept webhook POSTs — must always go to the network
  if (e.request.url.includes("n8n")) return;

  if (e.request.url.includes("sw.js")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // Cache successful GET responses (skip POST, non-2xx, opaque for fonts)
        if (e.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
