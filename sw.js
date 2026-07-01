const CACHE_NAME = 'starline-pwa-v17'; // ← ВАЖНО: новая версия!
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('workers.dev') || 
        event.request.url.includes('starline') ||
        event.request.url.includes('corsproxy')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});
