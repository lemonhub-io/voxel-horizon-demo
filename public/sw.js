/* Voxel Horizon service worker — offline shell + runtime asset cache */
/* global self, caches, clients, fetch, Request, Response, URL */

/** Bump on asset path / model identity changes so clients drop stale frog astronaut caches. */
const CACHE_VERSION = 'voxel-horizon-pwa-v4-ivory-outline-icon';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './favicon.ico',
  './favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './css/style.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Same-origin GET strategy:
 * - navigations: network first, fallback to cached shell
 * - 3D models (glb/gltf): network first (avoid stale character meshes)
 * - other static assets: cache first, then network
 * - external CDN: network first, cache on success
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never cache OPFS/save or non-http(s) schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (req.mode === 'navigate' || (req.destination === 'document' && sameOrigin)) {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  const path = url.pathname.toLowerCase();
  const isModel =
    path.endsWith('.glb') ||
    path.endsWith('.gltf') ||
    path.endsWith('.bin') ||
    path.includes('/models/');

  if (isModel) {
    event.respondWith(networkFirstOptionalCache(req));
    return;
  }

  if (sameOrigin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Third-party (CDN models, Google Fonts, etc.)
  event.respondWith(networkFirstOptionalCache(req));
});

async function networkFirstNavigation(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put('./index.html', fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached =
      (await cache.match(req)) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./'));
    if (cached) return cached;
    return new Response('离线不可用', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    return (
      (await cache.match(req)) ||
      new Response('', { status: 504, statusText: 'Offline' })
    );
  }
}

async function networkFirstOptionalCache(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('network offline');
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
