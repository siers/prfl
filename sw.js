// Hand-rolled service worker for offline app-shell caching.
//
// The two CACHE_VERSION/PRECACHE_URLS placeholders below are substituted by
// scripts/build-sw.js after `vite build`, since the built JS/CSS filenames
// are content-hashed and unknown ahead of time.
const CACHE_VERSION = '__CACHE_VERSION__'
const CACHE_NAME = `prfl-${CACHE_VERSION}`
const PRECACHE_URLS = __PRECACHE_URLS__

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))
    )
  )
  self.clients.claim()
})

// Stale-while-revalidate: serve the cached response immediately if present,
// and in the background fetch+store the latest version for next time. Falls
// back to network when nothing is cached yet (e.g. a request missed at
// install time). Only same-origin GETs go through the cache — cross-origin
// requests (e.g. the GitHub-backed asset browser) always hit the network.
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request)

      const networkFetch = fetch(request)
        .then(response => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => undefined)

      if (cached) {
        networkFetch.catch(() => {}) // revalidate in the background; ignore failures
        return cached
      }

      const fresh = await networkFetch
      if (fresh) return fresh

      throw new Error(`No cached or network response for ${request.url}`)
    })
  )
})
