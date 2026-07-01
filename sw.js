const CACHE_NAME = 'starline-pwa-v21';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(keys.map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // НЕ кэшируем script.js — всегда берём свежую версию
    if (event.request.url.includes('script.js')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Остальные файлы кэшируем
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
