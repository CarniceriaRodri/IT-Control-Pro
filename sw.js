const prefix = "it-control-pro:" + self.registration.scope + ":";
const current = prefix + "70a73434aa68";
const files = ["index.html","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","assets/app-BF-y_a_s.js","assets/app-DfIalRA2.css"];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(current).then((c) => c.addAll(files))),
);
self.addEventListener("message", (event) => {
  if (event.data === "activate") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith(prefix) && name !== current)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url),
    base = self.registration.scope;
  if (req.method !== "GET" || !url.href.startsWith(base)) return;
  const path = url.href.slice(base.length).split("?")[0];
  if (!files.includes(path) && path !== "") return;
  event.respondWith(
    caches
      .open(current)
      .then(async (c) => (await c.match(path || "index.html")) || fetch(req)),
  );
});
