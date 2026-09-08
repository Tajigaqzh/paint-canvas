/**
 * 缩略图 Dedicated Worker 入口。
 * 先收图片缓存 port，每次 render 先取齐本页图片再画 OffscreenCanvas。
 */
import { ImageCachePortClient } from "@/worker/image-cache/client";
import { closePageImages, loadPageImages } from "./images";
import { renderPage } from "./render";
import { IMAGE_CACHE_WORKER_BIND, type PageThumbnailWorkerRequest, type PageThumbnailWorkerResponse } from "./types";

type WorkerHost = {
  onmessage: ((event: MessageEvent<PageThumbnailWorkerRequest>) => void) | null;
  postMessage(message: PageThumbnailWorkerResponse, transfer?: Transferable[]): void;
};

const workerHost = self as unknown as WorkerHost;

let imageCacheClient: ImageCachePortClient | undefined;

/** 主线程 transfer 过来的 port，之后取图不再经过主线程。 */
const bindImageCachePort = (port: MessagePort | undefined) => {
  if (!port) return;

  imageCacheClient = new ImageCachePortClient(port);
};

/** 取图 → 绘制 → transfer 位图；无论成败都释放本页 ImageBitmap。 */
const handleRender = async (request: Extract<PageThumbnailWorkerRequest, { type: "render" }>) => {
  const { page, requestId, size } = request;
  let images: Map<string, ImageBitmap> | undefined;

  try {
    images = await loadPageImages(page, imageCacheClient);
    const bitmap = renderPage(page, size.width, size.height, images);

    workerHost.postMessage(
      {
        bitmap,
        pageId: page.id,
        requestId,
        type: "rendered",
      },
      [bitmap],
    );
  } catch (error) {
    workerHost.postMessage({
      error: error instanceof Error ? error.message : String(error),
      pageId: page.id,
      requestId,
      type: "error",
    });
  } finally {
    closePageImages(images);
  }
};

workerHost.onmessage = (event: MessageEvent<PageThumbnailWorkerRequest>) => {
  switch (event.data.type) {
    case IMAGE_CACHE_WORKER_BIND:
      bindImageCachePort(event.ports[0]);
      return;
    case "render":
      void handleRender(event.data);
      return;
  }
};
