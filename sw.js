/**
 * Service Worker for Music In His Name
 * Caches app shell files for offline use.
 */

const CACHE_NAME = 'mihn-app-v10';

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
    '/assets/js/preferences.js',
    '/assets/js/schedule.js',
    '/assets/js/init.js',
    '/assets/master/template.html',
    '/style/images/LOGO.svg',
    '/style/images/background.jpg'
];

const CDN_FILES = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=JetBrains+Mono:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// Install — cache app shell
self.addEventListener('install', (event) =>
{
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) =>
        {
            // Cache local files (bypass HTTP disk cache so updates are always fresh)
            for (const url of APP_SHELL_FILES)
            {
                try
                {
                    await cache.add(new Request(url, { cache: 'reload' }));
                } catch (e)
                {
                    try
                    {
                        await cache.add(url);
                    } catch (err)
                    {
                        console.warn('SW: Could not cache app shell file:', url, err);
                    }
                }
            }

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

// Fetch — network-first for local app shell, cache-first for external resources
self.addEventListener('fetch', (event) =>
{
    if (event.request.method !== 'GET')
    {
        return;
    }

    const url = new URL(event.request.url);

    // Only handle http/https requests (skip chrome-extension://, etc.)
    if (!url.protocol.startsWith('http'))
    {
        return;
    }

    // Let Supabase API calls go straight to network (they have localStorage fallbacks)
    if (url.hostname.includes('supabase.co'))
    {
        return;
    }

    // For our own app files (HTML, JS, CSS) use Network-First
    // This ensures updates are seen immediately when the user refreshes
    if (url.origin === self.location.origin)
    {
        event.respondWith(
            (async () =>
            {
                try
                {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    const networkResponse = await fetch(event.request, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (networkResponse && networkResponse.status === 200)
                    {
                        const responseClone = networkResponse.clone();
                        const pathnameClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) =>
                        {
                            cache.put(event.request, responseClone);
                            if (APP_SHELL_FILES.includes(url.pathname))
                            {
                                cache.put(url.pathname, pathnameClone);
                            }
                        });
                    }
                    return networkResponse;
                } catch (err)
                {
                    // Fallback to cache if network fails or times out
                    const exactMatch = await caches.match(event.request);
                    if (exactMatch) return exactMatch;

                    const ignoreSearchMatch = await caches.match(event.request, { ignoreSearch: true });
                    if (ignoreSearchMatch) return ignoreSearchMatch;

                    const pathnameMatch = await caches.match(url.pathname, { ignoreSearch: true });
                    if (pathnameMatch) return pathnameMatch;

                    if (event.request.mode === 'navigate')
                    {
                        const indexMatch = await caches.match('/index.html');
                        if (indexMatch) return indexMatch;
                    }
                    return new Response('Offline', { status: 503, statusText: 'Offline' });
                }
            })()
        );
        return;
    }

    // For external resources (CDNs) use Cache-First, then network
    event.respondWith(
        (async () =>
        {
            const exactCached = await caches.match(event.request);
            if (exactCached) return exactCached;

            try
            {
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.status === 200)
                {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) =>
                    {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            } catch (err)
            {
                const looseCached = await caches.match(event.request, { ignoreSearch: true });
                if (looseCached) return looseCached;
                return new Response('', { status: 504, statusText: 'Offline' });
            }
        })()
    );
});
