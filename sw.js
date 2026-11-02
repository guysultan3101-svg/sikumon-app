// Service worker: שומר את קבצי האפליקציה במכשיר, כדי שתיפתח מהר וגם בלי אינטרנט
const CACHE = "sikumon-v19";
const FILES = ["./", "index.html", "styles.css", "app.js", "recorder.js", "demo-data.js", "notes.js", "study.js", "extras.js", "practice.js", "planner.js", "ai.js", "tools.js", "social.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// קודם מהרשת (כדי לקבל עדכונים), ואם אין רשת – מהמכשיר
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request.mode === "navigate" ? e.request : new Request(e.request, { cache: "no-cache" })).then((res) => {
      const copy = res.clone();
      if (new URL(e.request.url).origin === location.origin) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
