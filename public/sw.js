/* 电影资讯 service worker (v1-20261113)
 * Navigations: network-first (offline falls back to cache) — a returning
 * visitor must not see the previous build's HTML first.
 * Static assets: stale-while-revalidate / cache-first.
 * Never cache /oauth2/, /api/, cross-origin, or non-200/redirected responses.
 * Bump CACHE_VERSION when this file or precache list changes.
 * 带 hash 的 chunk 不进预缓存（每次构建 hash 都变，写死必过期）；
 * 它们由下面的 fetch 处理按 /_next/static/ 走 cache-first 运行时缓存。
 */
'use strict';

var CACHE_VERSION = 'v9-20261113';
var SHELL_CACHE = 'news-shell-' + CACHE_VERSION;
var STATIC_CACHE = 'news-static-' + CACHE_VERSION;

var PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png"
];

var SHELL_PATHS = [];

function bypass(req, url) {
  if (req.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname === '/sw.js') return true;
  if (url.pathname.indexOf('/oauth2/') === 0) return true;
  if (url.pathname.indexOf('/api/') === 0) return true;
  return false;
}

function canCache(res) {
  if (!res || res.status !== 200) return false;
  if (res.type !== 'basic' && res.type !== 'default') return false;
  try {
    var u = new URL(res.url);
    if (u.origin !== self.location.origin) return false;
    if (u.pathname.indexOf('/oauth2/') === 0) return false;
    if (u.pathname.indexOf('/api/') === 0) return false;
  } catch (e) {
    return false;
  }
  return true;
}

function precacheList(cache) {
  return Promise.all(PRECACHE_URLS.map(function (u) {
    return cache.add(u).catch(function () { /* missing/stale hash must not fail install */ });
  }));
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(precacheList)
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  var expected = [SHELL_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf('news-') === 0 && expected.indexOf(k) === -1; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function staleWhileRevalidate(event, cacheName, cacheKey) {
  var req = event.request;
  return caches.open(cacheName).then(function (cache) {
    return cache.match(cacheKey).then(function (cached) {
      var update = fetch(req).then(function (res) {
        if (canCache(res)) cache.put(cacheKey, res.clone());
        return res;
      }).catch(function () { return undefined; });
      event.waitUntil(update);
      if (cached) return cached;
      return update.then(function (res) {
        if (res) return res;
        throw new Error('network unavailable');
      });
    });
  });
}

function cacheFirst(event, cacheName, cacheKey) {
  var req = event.request;
  return caches.open(cacheName).then(function (cache) {
    return cache.match(cacheKey).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (canCache(res)) cache.put(cacheKey, res.clone());
        return res;
      });
    });
  });
}

/* Navigations: network first so returning visitors get the newest HTML;
 * only fall back to the cached copy when the network is unavailable. */
function networkFirst(event, cacheName, cacheKey) {
  var req = event.request;
  return fetch(req).then(function (res) {
    if (canCache(res)) {
      var copy = res.clone();
      caches.open(cacheName).then(function (cache) {
        cache.put(cacheKey, copy);
      }).catch(function () { /* cache write must not fail the navigation */ });
    }
    return res;
  }).catch(function () {
    return caches.open(cacheName).then(function (cache) {
      return cache.match(cacheKey).then(function (cached) {
        if (cached) return cached;
        throw new Error('network unavailable');
      });
    });
  });
}

function isShellPath(pathname) {
  if (!SHELL_PATHS.length) {
    return true; // empty list = all same-origin navigations
  }
  return SHELL_PATHS.indexOf(pathname) !== -1 || SHELL_PATHS.indexOf(pathname + '/') !== -1;
}

function isHashedOrVersionedStatic(url) {
  if (!/\.(css|js|png|svg|ico|webp|woff2?|ttf|otf|jpg|jpeg|gif)$/.test(url.pathname)) return false;
  if (url.search.indexOf('v=') !== -1) return true;
  if (url.pathname.indexOf('/_next/static/') === 0) return true;
  if (url.pathname.indexOf('/assets/') === 0) return true;
  return false;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (bypass(req, url)) return;

  if (req.mode === 'navigate') {
    if (!isShellPath(url.pathname)) return; // network only
    event.respondWith(networkFirst(event, SHELL_CACHE, url.origin + url.pathname));
    return;
  }

  if (isHashedOrVersionedStatic(url) || url.pathname === '/manifest.json' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(event, STATIC_CACHE, req.url));
    return;
  }

  if (/\.(css|js|png|svg|ico|webp|woff2?|ttf|otf)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE, req.url));
  }
});
