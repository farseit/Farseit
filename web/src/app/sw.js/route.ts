export const dynamic = 'force-static';

// Service worker. public folder Docker-e copy hoy na, tai route hishebe serve kora hocche.
const SW = `
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});

self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      // admin panel khola ar dekha jachhe hole page-er nijer sound/toast-i enough
      var visible = list.some(function (c) { return c.visibilityState === 'visible'; });
      if (visible && !d.always) return;
      return self.registration.showNotification(d.title || 'Farse AI', {
        body: d.body || '',
        tag: d.tag || 'order',
        renotify: true,
        icon: '/pwa-icon/192',
        badge: '/pwa-icon/192',
        vibrate: [200, 100, 200],
        data: { url: d.url || '/shop/inbox' }
      });
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/shop';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
}