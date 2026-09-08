/**
 * 图片缓存跨线程协议。
 * 主线程 / 缩略图 worker 只发 URL，图片 Dedicated Worker 回传 Blob（不 transfer，发送方继续持有缓存）。
 */

/** 缓存命中层级，便于排查是内存、IndexedDB 还是网络。 */
export type ImageCacheSource = "memory" | "idb" | "network";

/**
 * 传给图片线程 L3 `fetch` 的可序列化参数。
 * 不含 signal / body：跨 worker 传不了 AbortSignal，取图也只走 GET。
 */
export type ImageCacheFetchInit = {
  cache?: RequestCache;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
  integrity?: string;
  mode?: RequestMode;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
};

/** L3 默认：走 CORS、不带 cookie，HTTP 缓存由浏览器自己决定。 */
export const DEFAULT_IMAGE_FETCH_INIT: ImageCacheFetchInit = {
  cache: "default",
  credentials: "omit",
  mode: "cors",
};

/** 调用方最终拿到的图片数据。 */
export type ImageBlobResult = {
  blob: Blob;
  source: ImageCacheSource;
};

/** 主线程把 MessageChannel 的一端交给图片 worker。 */
export const IMAGE_CACHE_HOST_BIND = "bind-client" as const;

/** 主线程把另一端 port 交给缩略图 worker，双方直连。 */
export const IMAGE_CACHE_WORKER_BIND = "bind-image-cache" as const;

/** 客户端向图片线程请求一张图。 */
export type ImageCacheGetRequest = {
  /** 覆盖 L3 fetch 默认参数；未传则用 DEFAULT_IMAGE_FETCH_INIT。 */
  fetchInit?: ImageCacheFetchInit;
  /** 用来把异步结果对回对应 Promise。 */
  requestId: string;
  type: "get";
  url: string;
};

/** 取图成功；blob 随 structured clone 发出，不列入 transfer 列表。 */
export type ImageCacheGetSuccess = {
  blob: Blob;
  requestId: string;
  source: ImageCacheSource;
  type: "result";
  url: string;
};

export type ImageCacheGetError = {
  error: string;
  requestId: string;
  type: "error";
  url: string;
};

export type ImageCacheClientRequest = ImageCacheGetRequest;

export type ImageCacheClientResponse = ImageCacheGetSuccess | ImageCacheGetError;

/** 主线程 → 图片 worker：附带 ports[0] 作为该客户端的专属通道。 */
export type ImageCacheHostMessage = {
  type: typeof IMAGE_CACHE_HOST_BIND;
};
