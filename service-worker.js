/**
 * Service Worker for Offline Support
 * Caches essential app files for offline access
 */

const CACHE_NAME = 'muso-app-v2';
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style/mainapp.css',
    '/style/jquery.transposer.css',
    '/style/song.css',
    '/assets/jquery/jquery.min.js',
    '/assets/jquery/jquery.transposer.js',
    '/assets/js/supabaseClient.js',
    '/assets/js/auth.js',
    '/assets/js/init.js',
    '/assets/js/keyManager.js',
    '/assets/js/organization.js',
    '/assets/js/schedule.js',
    '/assets/js/setlist.js',
    '/assets/js/songs.js',
    '/assets/js/ui.js',
    '/assets/master/template.html',
    '/style/images/LOGO.jpg'
];

// Install event - cache essential files
self.addEventListener('install', (event) =>
{
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) =>
            {
                console.log('[Service Worker] Caching essential files');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) =>
            {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) =>
{
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
            {
                return Promise.all(
                    cacheNames.map((cacheName) =>
                    {
                        if (cacheName !== CACHE_NAME)
                        {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache when offline, network when online
self.addEventListener('fetch', (event) =>
{
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET')
    {
        return;
    }

    // Skip external resources (CDN, Supabase API calls, etc.)
    if (url.origin !== location.origin)
    {
        return;
    }

    // Skip Supabase API calls - these should be handled by the app's cache logic
    if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/'))
    {
        return;
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true })
            .then((cachedResponse) =>
            {
                // Return cached response if available
                if (cachedResponse)
                {
                    // Still fetch in background to update cache
                    fetch(request)
                        .then((networkResponse) =>
                        {
                            if (networkResponse && networkResponse.status === 200)
                            {
                                caches.open(CACHE_NAME)
                                    .then((cache) =>
                                    {
                                        cache.put(request, networkResponse.clone());
                                    });
                            }
                        })
                        .catch(() =>
                        {
                            // Network fetch failed, but we have cache, so it's fine
                        });

                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then((networkResponse) =>
                    {
                        // Cache successful responses
                        if (networkResponse && networkResponse.status === 200)
                        {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) =>
                                {
                                    cache.put(request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) =>
                    {
                        console.error('[Service Worker] Fetch failed for:', request.url, error);

                        // If it's an HTML page request, return a generic offline page
                        if (request.headers.get('accept').includes('text/html'))
                        {
                            return new Response(
                                `<!DOCTYPE html>
                                <html>
                                <head>
                                    <title>Offline</title>
                                    <style>
                                        body {
                                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            height: 100vh;
                                            margin: 0;
                                            background: #f7f4ee;
                                        }
                                        .offline-message {
                                            text-align: center;
                                            padding: 2rem;
                                        }
                                        h1 { color: #0d1b2a; }
                                        p { color: #4b5a73; }
                                    </style>
                                </head>
                                <body>
                                    <div class="offline-message">
                                        <h1>You're Offline</h1>
                                        <p>Please check your internet connection and try again.</p>
                                    </div>
                                </body>
                                </html>`,
                                {
                                    headers: { 'Content-Type': 'text/html' }
                                }
                            );
                        }

                        throw error;
                    });
            })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) =>
{
    if (event.data && event.data.type === 'SKIP_WAITING')
    {
        self.skipWaiting();
    }
});
