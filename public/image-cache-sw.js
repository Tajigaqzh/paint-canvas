/**
 * 图片缓存 Service Worker。
 * 通过内存 LRU、Cache Storage 和 IndexedDB 元数据缓存图片响应，
 * 并合并相同 URL 的并发请求，避免重复访问网络。
 */
const IMAGE_CACHE_DB_NAME = "paint-canvas-image-cache-db";
const IMAGE_CACHE_DB_VERSION = 2;
const IMAGE_CACHE_ENTRY_VERSION = 3;

/** Cache Storage 保存响应 body，IndexedDB 保存响应元信息。 */
const IMAGE_CACHE_RESPONSE_CACHE_NAME = "paint-canvas-image-responses-v3";
const IMAGE_CACHE_RESPONSE_CACHE_PREFIX = "paint-canvas-image-responses-";
const IMAGE_CACHE_METADATA_STORE_NAME = "imageResponseMetadata";
const IMAGE_CACHE_LEGACY_STORE_NAME = "imageResponses";

/** 内存缓存容量限制，优先服务当前页面生命周期内的热图片。 */
const IMAGE_CACHE_MEMORY_MAX_ENTRIES = 32;
const IMAGE_CACHE_MEMORY_MAX_BYTES = 48 * 1024 * 1024;

/** 持久缓存容量限制，防止 IndexedDB 和 Cache Storage 无限增长。 */
const IMAGE_CACHE_IDB_MAX_ENTRIES = 200;
const IMAGE_CACHE_IDB_MAX_BYTES = 256 * 1024 * 1024;

/** 没有明确 max-age 时使用的默认缓存有效期。 */
const IMAGE_CACHE_FALLBACK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** 正在请求中的图片 promise，用来合并相同 URL 的并发请求。 */
const inflightImageRequests = new Map();

/** 后台重新校验中的图片 promise，避免过期图片重复 revalidate。 */
const backgroundImageRevalidations = new Map();

/** 内存级 LRU 缓存，只保存元数据，响应 body 仍从 Cache Storage 读取。 */
const memoryImageCache = new Map();
let memoryImageCacheBytes = 0;

/** 缓存代数；清空缓存时递增，用来让旧请求结果失效。 */
let imageCacheGeneration = 0;

/** IndexedDB 写入队列，保证写操作串行执行。 */
let indexedDbWriteQueue = Promise.resolve();

/** 安装后立即跳过 waiting，刷新页面即可使用新版本。 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

/** 激活时清理旧 Cache Storage，并接管当前页面。 */
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([deleteOutdatedImageResponseCaches(), self.clients.claim()]));
});

/** 拦截图片请求，非图片资源继续走浏览器默认请求链路。 */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (!shouldHandleImageRequest(request)) {
    return;
  }

  const responsePromise = getCachedImageResponse(request, event);

  event.respondWith(responsePromise);
  event.waitUntil(responsePromise.catch(() => undefined));
});

/** 接收页面发来的缓存清理消息，并通过 MessageChannel 返回结果。 */
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

/** 判断当前请求是否属于图片资源。 */
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

/**
 * 获取图片响应入口。
 * 同一个 cacheKey 已有请求在飞时，后续请求复用同一个 promise 并返回 clone。
 */
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

/**
 * 按内存、IndexedDB 元数据、过期可用缓存、网络请求的顺序解析图片响应。
 * 新鲜缓存直接返回；过期缓存先返回 stale，再后台 revalidate。
 */
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

/** 安排过期缓存的后台重新校验，避免阻塞当前响应。 */
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

/** 规范化缓存 key，目前直接使用完整 URL。 */
function getImageCacheKey(rawUrl) {
  const url = new URL(rawUrl);

  return url.toString();
}

/** 过滤掉旧版本元数据，避免结构变更后误用历史缓存。 */
function getUsableImageCacheEntry(entry) {
  return entry?.cacheVersion === IMAGE_CACHE_ENTRY_VERSION ? entry : undefined;
}

/** 判断缓存条目是否可用且没有过期。 */
function isImageCacheEntryFresh(entry) {
  return getUsableImageCacheEntry(entry) !== undefined && entry.expiresAt > Date.now();
}

/** 判断网络响应是否适合写入图片缓存。 */
function canCacheImageResponse(response) {
  return (
    response.ok &&
    response.type !== "opaque" &&
    !hasCacheControlDirective(response.headers, "no-store")
  );
}

/** 基于网络响应生成 IndexedDB 里保存的图片元数据。 */
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

/** 同时写入响应 body、内存元数据和 IndexedDB 元数据。 */
async function persistImageCacheEntry(entry, responseToCache) {
  if (responseToCache) {
    await putCachedImageResponse(entry.url, responseToCache);
  }

  setMemoryImageCacheEntry(entry);
  await putIndexedDbImageCacheEntry(entry);
}

/** 通过元数据找到 Cache Storage 里的响应，并附加缓存层级标识。 */
async function createResponseFromEntry(entry, cacheLevel) {
  const cachedResponse = await getCachedImageCacheResponse(entry.url);

  if (!cachedResponse) {
    return null;
  }

  return withCacheLevelHeader(cachedResponse, cacheLevel);
}

/** 给响应补充调试用的缓存层级响应头。 */
function withCacheLevelHeader(response, cacheLevel) {
  const headers = new Headers(response.headers);

  headers.set("X-Image-Cache-Level", cacheLevel);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** 使用 ETag 或 Last-Modified 对已缓存图片执行条件请求。 */
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

/** 根据缓存响应头创建条件请求。 */
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

/** 始终以 no-cache 发起真实网络请求，让浏览器向服务器确认资源状态。 */
function fetchImageRequest(request) {
  return fetch(
    new Request(request, {
      cache: "no-cache",
    }),
  );
}

/** 304 返回时刷新元数据，并沿用原缓存 body。 */
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

/** 合并 304 响应头，跳过和 body 长度或编码强相关的头。 */
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

/** 根据 Cache-Control 计算缓存过期时间。 */
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

/** 读取 Cache-Control 里的 max-age 秒数。 */
function getCacheControlMaxAgeSeconds(headers) {
  const cacheControl = headers.get("Cache-Control");

  if (!cacheControl) {
    return null;
  }

  const maxAgeMatch = cacheControl.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i);

  return maxAgeMatch ? Number(maxAgeMatch[1]) : null;
}

/** 判断 Cache-Control 是否包含指定指令。 */
function hasCacheControlDirective(headers, directive) {
  const cacheControl = headers.get("Cache-Control");

  return cacheControl
    ? new RegExp(`(?:^|,)\\s*${directive}\\s*(?:,|$)`, "i").test(cacheControl)
    : false;
}

/** 计算响应 body 字节数，优先使用 Content-Length。 */
async function getImageResponseByteLength(response) {
  const contentLength = response.headers.get("Content-Length");

  if (contentLength && /^\d+$/.test(contentLength)) {
    return Number(contentLength);
  }

  return (await response.clone().arrayBuffer()).byteLength;
}

/** 从 Cache Storage 读取图片响应。 */
async function getCachedImageCacheResponse(cacheKey) {
  const cache = await caches.open(IMAGE_CACHE_RESPONSE_CACHE_NAME);

  return cache.match(cacheKey);
}

/** 把图片响应写入 Cache Storage。 */
async function putCachedImageResponse(cacheKey, response) {
  const cache = await caches.open(IMAGE_CACHE_RESPONSE_CACHE_NAME);

  await cache.put(cacheKey, response.clone());
}

/** 删除 Cache Storage 中的单个图片响应。 */
async function deleteCachedImageResponse(cacheKey) {
  const cache = await caches.open(IMAGE_CACHE_RESPONSE_CACHE_NAME);

  await cache.delete(cacheKey);
}

/** 删除旧版本命名的 Cache Storage，避免版本升级后占用空间。 */
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

/** 读取内存缓存条目，并刷新 LRU 顺序。 */
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

/** 写入内存缓存条目，并触发 LRU 裁剪。 */
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

/** 从内存缓存中移除单个条目，同时维护总字节数。 */
function removeMemoryImageCacheEntry(cacheKey) {
  const entry = memoryImageCache.get(cacheKey);

  if (!entry) {
    return;
  }

  memoryImageCache.delete(cacheKey);
  memoryImageCacheBytes -= entry.byteLength;
}

/** 按 LRU 顺序裁剪内存缓存，直到数量和字节数都在限制内。 */
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

/** 打开图片缓存 IndexedDB，并在升级时创建或迁移 object store。 */
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

/** 等待写队列完成后读取 IndexedDB 元数据，避免读到旧值。 */
async function getIndexedDbImageCacheEntry(cacheKey) {
  await waitForIndexedDbWrites();

  const db = await openImageCacheDb();

  return runImageCacheStoreRequest(db, "readonly", (store) => store.get(cacheKey));
}

/** 写入 IndexedDB 元数据，并在写完后裁剪持久缓存。 */
async function putIndexedDbImageCacheEntry(entry) {
  return enqueueIndexedDbWrite(async () => {
    const db = await openImageCacheDb();

    await runImageCacheStoreRequest(db, "readwrite", (store) => store.put(entry));
    await pruneIndexedDbImageCache();
  });
}

/** 更新 IndexedDB 条目的访问时间，用于持久缓存 LRU。 */
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

/** 删除 IndexedDB 中的单个元数据条目。 */
async function deleteIndexedDbImageCacheEntry(cacheKey) {
  return enqueueIndexedDbWrite(async () => {
    const db = await openImageCacheDb();

    await runImageCacheStoreRequest(db, "readwrite", (store) => store.delete(cacheKey));
  });
}

/** 删除一张图片在三层缓存中的所有记录。 */
async function deleteImageCacheEntry(cacheKey) {
  removeMemoryImageCacheEntry(cacheKey);

  await Promise.all([
    deleteCachedImageResponse(cacheKey),
    deleteIndexedDbImageCacheEntry(cacheKey),
  ]);
}

/** 按最近访问时间裁剪 IndexedDB 元数据，并同步删除 Cache Storage 响应。 */
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

/** 把 IndexedDB request 封装成 Promise，统一处理事务错误。 */
function runImageCacheStoreRequest(db, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGE_CACHE_METADATA_STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(IMAGE_CACHE_METADATA_STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

/** 清空所有图片缓存，并让当前请求代数失效。 */
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

/** 等待当前 IndexedDB 写入队列结束。 */
async function waitForIndexedDbWrites() {
  await indexedDbWriteQueue.catch(() => undefined);
}

/** 串行化 IndexedDB 写任务，避免多个 readwrite 事务互相抢占。 */
function enqueueIndexedDbWrite(task) {
  const queuedTask = indexedDbWriteQueue.catch(() => undefined).then(task);

  indexedDbWriteQueue = queuedTask.catch(() => undefined);

  return queuedTask;
}
