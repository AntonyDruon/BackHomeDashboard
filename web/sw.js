// Service worker : met en cache l'interface pour qu'elle s'ouvre instantanément.
// Les données (API) ne sont jamais mises en cache : toujours fraîches.
const VERSION = "hd-v3";
const SHELL = [
  "/",
  "/index.html",
  "/style.css?v=3",
  "/app.js?v=3",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const isShell = req.mode === "navigate" || SHELL.includes(url.pathname + url.search);
  if (!isShell) return; // API : réseau uniquement

  // Réseau d'abord (mises à jour immédiates), cache si hors ligne
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req.mode === "navigate" ? "/" : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? "/" : req))
  );
});
