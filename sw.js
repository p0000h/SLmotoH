const CACHE_NAME = 'starline-pwa-v1';
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

// Стратегия: сеть, с фолбэком на кэш
self.addEventListener('fetch', event => {
    // API-запросы не кэшируем
    if (event.request.url.includes('starline-online.ru') || 
        event.request.url.includes('corsproxy') ||
        event.request.url.includes('allorigins')) {
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