/**
 * 主线程入口。
 * 缩略图 worker 不要引用本文件：会把 `new Worker(imageCache.worker)` 打进缩略图包。
 * 缩略图请直接引用 `./client` 与 `./types`。
 */
export { ImageCachePortClient } from "./client";
export { DEFAULT_IMAGE_FETCH_INIT, IMAGE_CACHE_WORKER_BIND } from "./types";
export type { ImageBlobResult, ImageCacheFetchInit, ImageCacheSource } from "./types";
export { getImageBlob, getImageCacheWorkerManager, ImageCacheWorkerManager } from "./workerManager";
