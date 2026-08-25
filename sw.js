const CACHE_NAME = "jinke-v1.0.7";
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app-bundle.js",
  "./manifest.webmanifest",
  "./project-identity.json",
  "./vendor/react.production.min.js",
  "./vendor/react-dom.production.min.js",
  "./assets/app-icon-512.png",
  "./assets/mark-256.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
