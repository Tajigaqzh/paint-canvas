const IMAGE_CACHE_DB_NAME = "paint-canvas-image-cache-db";
const IMAGE_CACHE_DB_VERSION = 2;
const IMAGE_CACHE_ENTRY_VERSION = 3;
const IMAGE_CACHE_RESPONSE_CACHE_NAME = "paint-canvas-image-responses-v3";
const IMAGE_CACHE_RESPONSE_CACHE_PREFIX = "paint-canvas-image-responses-";
const IMAGE_CACHE_METADATA_STORE_NAME = "imageResponseMetadata";
const IMAGE_CACHE_LEGACY_STORE_NAME = "imageResponses";
const IMAGE_CACHE_MEMORY_MAX_ENTRIES = 32;
const IMAGE_CACHE_MEMORY_MAX_BYTES = 48 * 1024 * 1024;
const IMAGE_CACHE_IDB_MAX_ENTRIES = 200;
const IMAGE_CACHE_IDB_MAX_BYTES = 256 * 1024 * 1024;
const IMAGE_CACHE_FALLBACK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const inflightImageRequests = new Map();
const backgroundImageRevalidations = new Map();
const memoryImageCache = new Map();
let memoryImageCacheBytes = 0;
let imageCacheGeneration = 0;
let indexedDbWriteQueue = Promise.resolve();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([deleteOutdatedImageResponseCaches(), self.clients.claim()]));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (!shouldHandleImageRequest(request)) {
    return;
  }

  const responsePromise = getCachedImageResponse(request, event);

  event.respondWith(responsePromise);
  event.waitUntil(responsePromise.catch(() => undefined));
});

self.addEventListener("message", (event) => {
  const message = event.data;

  if (!message || message.type !== "clear-image-cache") {
    return;
  }

  clearImageCaches()
    .then(() => {
      event.ports[0]?.postMessage({ ok: true, type: "clear-image-cache-complete" });
    })
    .catch((error) => {
      event.ports[0]?.postMessage({
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        type: "clear-image-cache-complete",
      });
    });
});

function shouldHandleImageRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  if (request.destination === "image") {
    return true;
  }

  const url = new URL(request.url);
  return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(url.pathname);
}

async function getCachedImageResponse(request, event) {
  const cacheKey = getImageCacheKey(request.url);
  const existingRequest = inflightImageRequests.get(cacheKey);

  if (existingRequest) {
    return existingRequest.then((response) => response.clone());
  }

  const requestGeneration = imageCacheGeneration;
  const requestPromise = resolveImageResponse(request, cacheKey, requestGeneration, event).finally(
    () => {
      if (inflightImageRequests.get(cacheKey) === requestPromise) {
        inflightImageRequests.delete(cacheKey);
      }
    },
  );

  inflightImageRequests.set(cacheKey, requestPromise);

  return requestPromise.then((response) => response.clone());
}

async function resolveImageResponse(request, cacheKey, requestGeneration, event) {
  const memoryEntry = getMemoryImageCacheEntry(cacheKey);

  if (
    memoryEntry &&
    requestGeneration === imageCacheGeneration &&
    isImageCacheEntryFresh(memoryEntry)
  ) {
    const cachedResponse = await createResponseFromEntry(memoryEntry, "memory");

    if (cachedResponse) {
      return cachedResponse;
    }
  }

  const idbEntry = await getIndexedDbImageCacheEntry(cacheKey);
  const cachedEntry = getUsableImageCacheEntry(memoryEntry) ?? getUsableImageCacheEntry(idbEntry);

  if (idbEntry && requestGeneration === imageCacheGeneration && isImageCacheEntryFresh(idbEntry)) {
    const cachedResponse = await createResponseFromEntry(idbEntry, "cache-storage");

    if (cachedResponse) {
      setMemoryImageCacheEntry(idbEntry);
      void touchIndexedDbImageCacheEntry(cacheKey);

      return cachedResponse;
    }
  }

  if (cachedEntry) {
    const staleResponse = await createResponseFromEntry(cachedEntry, "stale");

    if (staleResponse) {
      scheduleImageCacheRevalidation(request, cacheKey, cachedEntry, requestGeneration, event);

      return staleResponse;
    }

    try {
      const revalidationResult = await revalidateImageCacheEntry(request, cacheKey, cachedEntry);

      if (revalidationResult.entry && requestGeneration === imageCacheGeneration) {
        await persistImageCacheEntry(revalidationResult.entry, revalidationResult.responseToCache);

        const cachedResponse = await createResponseFromEntry(
          revalidationResult.entry,
          revalidationResult.cacheLevel,
        );

        if (cachedResponse) {
          return cachedResponse;
        }
      }

      if (revalidationResult.response) {
        if (requestGeneration === imageCacheGeneration) {
          await deleteImageCacheEntry(cacheKey);
        }

        return withCacheLevelHeader(revalidationResult.response, "network");
      }
    } catch {}
  }

  const networkResponse = await fetchImageRequest(request);

  if (!canCacheImageResponse(networkResponse)) {
    return withCacheLevelHeader(networkResponse, "network");
  }

  const cacheEntry = await createImageCacheEntry(cacheKey, networkResponse);

  if (requestGeneration === imageCacheGeneration) {
    await persistImageCacheEntry(cacheEntry, networkResponse);

    const cachedResponse = await createResponseFromEntry(cacheEntry, "network");

    if (cachedResponse) {
      return cachedResponse;
    }
  }

  return withCacheLevelHeader(networkResponse, "network");
}

function scheduleImageCacheRevalidation(request, cacheKey, cachedEntry, requestGeneration, event) {
  const existingRevalidation = backgroundImageRevalidations.get(cacheKey);

  if (existingRevalidation) {
    event?.waitUntil(existingRevalidation.catch(() => undefined));
    return;
  }

  const revalidationPromise = (async () => {
    try {
      const revalidationResult = await revalidateImageCacheEntry(request, cacheKey, cachedEntry);

      if (requestGeneration !== imageCacheGeneration) {
        return;
      }

      if (revalidationResult.entry) {
        await persistImageCacheEntry(revalidationResult.entry, revalidationResult.responseToCache);
        return;
      }

      if (revalidationResult.response) {
        await deleteImageCacheEntry(cacheKey);
      }
    } catch {
      // Keep serving the stale entry when background revalidation fails.
    } finally {
      if (backgroundImageRevalidations.get(cacheKey) === revalidationPromise) {
        backgroundImageRevalidations.delete(cacheKey);
      }
    }
  })();

  backgroundImageRevalidations.set(cacheKey, revalidationPromise);
  event?.waitUntil(revalidationPromise.catch(() => undefined));
}

function getImageCacheKey(rawUrl) {
  const url = new URL(rawUrl);

  return url.toString();
}

function getUsableImageCacheEntry(entry) {
  return entry?.cacheVersion === IMAGE_CACHE_ENTRY_VERSION ? entry : undefined;
}

function isImageCacheEntryFresh(entry) {
  return getUsableImageCacheEntry(entry) !== undefined && entry.expiresAt > Date.now();
}

function canCacheImageResponse(response) {
  return (
    response.ok &&
    response.type !== "opaque" &&
    !hasCacheControlDirective(response.headers, "no-store")
  );
}

async function createImageCacheEntry(cacheKey, response) {
  const headers = Array.from(response.headers.entries());
  const byteLength = await getImageResponseByteLength(response);
  const now = Date.now();

  return {
    byteLength,
    cacheVersion: IMAGE_CACHE_ENTRY_VERSION,
    createdAt: now,
    expiresAt: getImageCacheExpiresAt(new Headers(headers), now),
    headers,
    lastAccessedAt: now,
    revalidatedAt: now,
    status: response.status,
    statusText: response.statusText,
    url: cacheKey,
  };
}

async function persistImageCacheEntry(entry, responseToCache) {
  if (responseToCache) {
    await putCachedImageResponse(entry.url, responseToCache);
  }

  setMemoryImageCacheEntry(entry);
  await putIndexedDbImageCacheEntry(entry);
}

async function createResponseFromEntry(entry, cacheLevel) {
  const cachedResponse = await getCachedImageCacheResponse(entry.url);

  if (!cachedResponse) {
    return null;
  }

  return withCacheLevelHeader(cachedResponse, cacheLevel);
}

function withCacheLevelHeader(response, cacheLevel) {
  const headers = new Headers(response.headers);

  headers.set("X-Image-Cache-Level", cacheLevel);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function revalidateImageCacheEntry(request, cacheKey, cachedEntry) {
  const response = await fetchImageRequest(createRevalidationRequest(request, cachedEntry));

  if (response.status === 304) {
    return {
      cacheLevel: "revalidated",
      entry: refreshImageCacheEntry(cachedEntry, response),
    };
  }

  if (!canCacheImageResponse(response)) {
    return { response };
  }

  return {
    cacheLevel: "network",
    entry: await createImageCacheEntry(cacheKey, response),
    responseToCache: response,
  };
}

function createRevalidationRequest(request, cachedEntry) {
  const headers = new Headers(request.headers);
  const cachedHeaders = new Headers(cachedEntry.headers);
  const etag = cachedHeaders.get("ETag");
  const lastModified = cachedHeaders.get("Last-Modified");

  if (etag) {
    headers.set("If-None-Match", etag);
  }

  if (lastModified) {
    headers.set("If-Modified-Since", lastModified);
  }

  return new Request(request, {
    cache: "no-cache",
    headers,
  });
}

function fetchImageRequest(request) {
  return fetch(
    new Request(request, {
      cache: "no-cache",
    }),
  );
}

function refreshImageCacheEntry(entry, response) {
  const headers = mergeRevalidatedHeaders(entry.headers, response.headers);
  const now = Date.now();

  return {
    ...entry,
    cacheVersion: IMAGE_CACHE_ENTRY_VERSION,
    expiresAt: getImageCacheExpiresAt(new Headers(headers), now),
    headers,
    lastAccessedAt: now,
    revalidatedAt: now,
  };
}

function mergeRevalidatedHeaders(cachedHeaders, revalidationHeaders) {
  const headers = new Headers(cachedHeaders);
  const bodySpecificHeaders = new Set([
    "content-encoding",
    "content-length",
    "content-range",
    "transfer-encoding",
  ]);

  revalidationHeaders.forEach((value, key) => {
    if (!bodySpecificHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return Array.from(headers.entries());
}

function getImageCacheExpiresAt(headers, now) {
  if (hasCacheControlDirective(headers, "no-cache")) {
    return now;
  }

  const maxAgeSeconds = getCacheControlMaxAgeSeconds(headers);

  if (maxAgeSeconds === null) {
    return now + IMAGE_CACHE_FALLBACK_MAX_AGE_MS;
  }

  return now + maxAgeSeconds * 1000;
}

function getCacheControlMaxAgeSeconds(headers) {
  const cacheControl = headers.get("Cache-Control");

  if (!cacheControl) {
    return null;
  }

  const maxAgeMatch = cacheControl.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i);

  return maxAgeMatch ? Number(maxAgeMatch[1]) : null;
}

function hasCacheControlDirective(headers, directive) {
  const cacheControl = headers.get("Cache-Control");

  return cacheControl
    ? new RegExp(`(?:^|,)\\s*${directive}\\s*(?:,|$)`, "i").test(cacheControl)
    : false;
}

async function getImageResponseByteLength(response) {
  const contentLength = response.headers.get("Content-Length");

  if (contentLength && /^\d+$/.test(contentLength)) {
    return Number(contentLength);
  }

  return (await response.clone().arrayBuffer()).byteLength;
}

async function getCachedImageCacheResponse(cacheKey) {
  const cache = await caches.open(IMAGE_CACHE_RESPONSE_CACHE_NAME);

  return cache.match(cacheKey);
}

async function putCachedImageResponse(cacheKey, response) {
  const cache = await caches.open(IMAGE_CACHE_RESPONSE_CACHE_NAME);

  await cache.put(cacheKey, response.clone());
}

async function deleteCachedImageResponse(cacheKey) {
  const cache = await caches.open(IMAGE_CACHE_RESPONSE_CACHE_NAME);

  await cache.delete(cacheKey);
}

async function deleteOutdatedImageResponseCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith(IMAGE_CACHE_RESPONSE_CACHE_PREFIX) &&
          cacheName !== IMAGE_CACHE_RESPONSE_CACHE_NAME,
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
}

function getMemoryImageCacheEntry(cacheKey) {
  const entry = memoryImageCache.get(cacheKey);

  if (!entry) {
    return undefined;
  }

  memoryImageCache.delete(cacheKey);
  entry.lastAccessedAt = Date.now();
  memoryImageCache.set(cacheKey, entry);

  return entry;
}

function setMemoryImageCacheEntry(entry) {
  const existingEntry = memoryImageCache.get(entry.url);

  if (existingEntry) {
    memoryImageCacheBytes -= existingEntry.byteLength;
    memoryImageCache.delete(entry.url);
  }

  memoryImageCache.set(entry.url, entry);
  memoryImageCacheBytes += entry.byteLength;
  pruneMemoryImageCache();
}

function removeMemoryImageCacheEntry(cacheKey) {
  const entry = memoryImageCache.get(cacheKey);

  if (!entry) {
    return;
  }

  memoryImageCache.delete(cacheKey);
  memoryImageCacheBytes -= entry.byteLength;
}

function pruneMemoryImageCache() {
  while (
    memoryImageCache.size > IMAGE_CACHE_MEMORY_MAX_ENTRIES ||
    memoryImageCacheBytes > IMAGE_CACHE_MEMORY_MAX_BYTES
  ) {
    const oldestKey = memoryImageCache.keys().next().value;

    if (!oldestKey) {
      memoryImageCacheBytes = 0;
      return;
    }

    removeMemoryImageCacheEntry(oldestKey);
  }
}

function openImageCacheDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_CACHE_DB_NAME, IMAGE_CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (db.objectStoreNames.contains(IMAGE_CACHE_LEGACY_STORE_NAME)) {
        db.deleteObjectStore(IMAGE_CACHE_LEGACY_STORE_NAME);
      }

      if (!db.objectStoreNames.contains(IMAGE_CACHE_METADATA_STORE_NAME)) {
        db.createObjectStore(IMAGE_CACHE_METADATA_STORE_NAME, { keyPath: "url" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIndexedDbImageCacheEntry(cacheKey) {
  await waitForIndexedDbWrites();

  const db = await openImageCacheDb();

  return runImageCacheStoreRequest(db, "readonly", (store) => store.get(cacheKey));
}

async function putIndexedDbImageCacheEntry(entry) {
  return enqueueIndexedDbWrite(async () => {
    const db = await openImageCacheDb();

    await runImageCacheStoreRequest(db, "readwrite", (store) => store.put(entry));
    await pruneIndexedDbImageCache();
  });
}

async function touchIndexedDbImageCacheEntry(cacheKey) {
  return enqueueIndexedDbWrite(async () => {
    const db = await openImageCacheDb();
    const entry = await runImageCacheStoreRequest(db, "readonly", (store) => store.get(cacheKey));

    if (!entry) {
      return;
    }

    entry.lastAccessedAt = Date.now();

    await runImageCacheStoreRequest(db, "readwrite", (store) => store.put(entry));
  });
}

async function deleteIndexedDbImageCacheEntry(cacheKey) {
  return enqueueIndexedDbWrite(async () => {
    const db = await openImageCacheDb();

    await runImageCacheStoreRequest(db, "readwrite", (store) => store.delete(cacheKey));
  });
}

async function deleteImageCacheEntry(cacheKey) {
  removeMemoryImageCacheEntry(cacheKey);

  await Promise.all([
    deleteCachedImageResponse(cacheKey),
    deleteIndexedDbImageCacheEntry(cacheKey),
  ]);
}

async function pruneIndexedDbImageCache() {
  const db = await openImageCacheDb();
  const entries = await runImageCacheStoreRequest(db, "readonly", (store) => store.getAll());
  let totalBytes = entries.reduce((sum, entry) => sum + entry.byteLength, 0);

  entries.sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);

  const keysToDelete = [];

  while (
    entries.length - keysToDelete.length > IMAGE_CACHE_IDB_MAX_ENTRIES ||
    totalBytes > IMAGE_CACHE_IDB_MAX_BYTES
  ) {
    const entry = entries[keysToDelete.length];

    if (!entry) {
      break;
    }

    keysToDelete.push(entry.url);
    totalBytes -= entry.byteLength;
  }

  if (keysToDelete.length === 0) {
    return;
  }

  const writeDb = await openImageCacheDb();

  await Promise.all(
    keysToDelete.map((cacheKey) =>
      runImageCacheStoreRequest(writeDb, "readwrite", (store) => store.delete(cacheKey)),
    ),
  );
  await Promise.all(keysToDelete.map((cacheKey) => deleteCachedImageResponse(cacheKey)));
}

function runImageCacheStoreRequest(db, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGE_CACHE_METADATA_STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(IMAGE_CACHE_METADATA_STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearImageCaches() {
  imageCacheGeneration += 1;
  inflightImageRequests.clear();
  backgroundImageRevalidations.clear();
  memoryImageCache.clear();
  memoryImageCacheBytes = 0;

  await enqueueIndexedDbWrite(async () => {
    const db = await openImageCacheDb();

    await runImageCacheStoreRequest(db, "readwrite", (store) => store.clear());
  });
  await caches.delete(IMAGE_CACHE_RESPONSE_CACHE_NAME);
}

async function waitForIndexedDbWrites() {
  await indexedDbWriteQueue.catch(() => undefined);
}

function enqueueIndexedDbWrite(task) {
  const queuedTask = indexedDbWriteQueue.catch(() => undefined).then(task);

  indexedDbWriteQueue = queuedTask.catch(() => undefined);

  return queuedTask;
}
