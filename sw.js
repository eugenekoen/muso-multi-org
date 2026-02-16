/**
 * Service Worker for Music In His Name
 * Caches app shell files for offline use.
 */

const CACHE_NAME = 'mihn-app-v2';

const APP_SHELL_FILES = [
    '/',
    '/index.html',
    '/style/mainapp.css',
    '/style/jquery.transposer.css',
    '/style/song.css',
    '/assets/jquery/jquery.min.js',
    '/assets/jquery/jquery.transposer.js',
    '/assets/js/supabaseClient.js',
    '/assets/js/auth.js',
    '/assets/js/songs.js',
    '/assets/js/setlist.js',
    '/assets/js/ui.js',
    '/assets/js/organization.js',
    '/assets/js/keyManager.js',
    '/assets/js/schedule.js',
    '/assets/js/init.js',
    '/assets/master/template.html',
    '/style/images/LOGO.jpg',
    '/style/images/background.jpg'
];

const CDN_FILES = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// Install — cache app shell
self.addEventListener('install', (event) =>
{
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) =>
        {
            // Cache local files
            await cache.addAll(APP_SHELL_FILES);

            // Cache CDN files individually (don't fail install if a CDN is down)
            for (const url of CDN_FILES)
            {
                try
                {
                    await cache.add(url);
                } catch (e)
                {
                    console.warn('SW: Could not cache CDN resource:', url, e);
                }
            }
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) =>
{
    event.waitUntil(
        caches.keys().then((keys) =>
        {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — cache-first for app shell, network-first for API calls
self.addEventListener('fetch', (event) =>
{
    const url = new URL(event.request.url);

    // Only handle http/https requests (skip chrome-extension://, etc.)
    if (!url.protocol.startsWith('http'))
    {
        return;
    }

    // Let Supabase API calls go straight to network (they have localStorage fallbacks)
    if (url.hostname.includes('supabase'))
    {
        return;
    }

    // For all other requests: try cache first, then network
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) =>
        {
            if (cachedResponse)
            {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) =>
            {
                // Cache new same-origin resources we haven't seen before
                if (networkResponse && networkResponse.status === 200
                    && url.origin === self.location.origin)
                {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) =>
                    {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() =>
            {
                // If both cache and network fail, return a basic offline fallback
                if (event.request.mode === 'navigate')
                {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
