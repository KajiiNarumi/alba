const CACHE_NAME = 'alba-pwa-v0.7.25.24'; // Cambio de versión aquí
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './sunrise.png', // IMPORTANTE: Lee la nota de abajo sobre este archivo
    './manifest.json',
    './Ink/',
    './Lux/',
    './Kron/'
];

// Instalar y cachear (se ejecuta al detectar cambios en sw.js)
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// Limpiar caché vieja (ESTO FORZA LA ACTUALIZACIÓN)
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                          .map(name => caches.delete(name))
            );
        })
    );
});

// Servir desde caché o buscar en red
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request);
        })
    );
});
