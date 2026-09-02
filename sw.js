self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    try {
        const url = new URL(event.request.url);

        if (url.searchParams.get('qr-relatorio') === 'login') {
            return;
        }
    } catch (e) {}

    event.respondWith(fetch(event.request));
});