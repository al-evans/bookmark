const CACHE_NAME = 'reading-goals-v36';

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isCacheableStaticAsset(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (isNavigationRequest(request)) return false;
  if (isApiRequest(url)) return false;
  return /\.(?:js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|json|woff2?|ttf)$/i.test(url.pathname);
}

// On install: cache all pre-cached assets provided by Vite's build manifest
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
});

// On activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first strategy: serve from cache, fall back to network and cache the response
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isNavigationRequest(event.request)) {
    // Navigation should prefer network so deploys do not get stuck on old app shells.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', cloned));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return cache.match('/') || Response.error();
        }),
    );
    return;
  }

  if (!isCacheableStaticAsset(event.request, url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      });
    }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: '📚 Reading reminder',
    body: "You haven't logged any reading today! Keep your streak alive.",
    tag: 'reading-reminder',
    url: '/',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      // Keep fallback payload.
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon-192.png?v=20260520-27',
      badge: '/favicon-32.png?v=20260520-27',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin));
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
