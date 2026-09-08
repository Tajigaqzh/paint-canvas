import { ImageCachePortClient } from "./client";
import { IMAGE_CACHE_HOST_BIND, IMAGE_CACHE_WORKER_BIND } from "./types";
import type { ImageCacheFetchInit, ImageCacheHostMessage } from "./types";

/**
 * 主线程持有的图片缓存 Dedicated Worker。
 * 自己通过 MessagePort 要图，也会给每个缩略图 worker 转交一条独立 port。
 * 会话期内常驻，不随缩略图 worker terminate 一起关掉。
 */
export class ImageCacheWorkerManager {
  private readonly client: ImageCachePortClient;

  private readonly worker: Worker;

  constructor() {
    this.worker = new Worker(new URL("./imageCache.worker.ts", import.meta.url), {
      type: "module",
    });
    this.client = new ImageCachePortClient(this.createClientPort());
  }

  getBlob(url: string, fetchInit?: ImageCacheFetchInit) {
    return this.client.getBlob(url, fetchInit);
  }

  /** 给缩略图 Dedicated Worker 接上图片缓存 port，双方直连，不经过主线程搬像素。 */
  bindToWorker(target: Worker) {
    target.postMessage({ type: IMAGE_CACHE_WORKER_BIND }, [this.createClientPort()]);
  }

  /**
   * 每连一个调用方就新建一条 MessageChannel：
   * port1 交给图片 worker，port2 留给主线程自己或转给缩略图 worker。
   */
  private createClientPort() {
    const channel = new MessageChannel();
    const message: ImageCacheHostMessage = { type: IMAGE_CACHE_HOST_BIND };

    this.worker.postMessage(message, [channel.port1]);
    return channel.port2;
  }
}

let imageCacheWorkerManager: ImageCacheWorkerManager | undefined;

/** 全局单例；主画布和缩略图调度器共用同一个图片线程。 */
export const getImageCacheWorkerManager = () => {
  if (!imageCacheWorkerManager) {
    imageCacheWorkerManager = new ImageCacheWorkerManager();
  }

  return imageCacheWorkerManager;
};

/** 主画布向图片线程取 Blob；不要在主线程直接 fetch 图片 URL。 */
export const getImageBlob = (url: string, fetchInit?: ImageCacheFetchInit) =>
  getImageCacheWorkerManager().getBlob(url, fetchInit);
