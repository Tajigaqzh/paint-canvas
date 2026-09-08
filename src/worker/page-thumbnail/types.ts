/**
 * 主线程 ↔ 缩略图 worker 的消息协议。
 * bind 时主线程 transfer 一条连到图片缓存的 MessagePort；render 时传入整页节点树。
 */
import type { CanvasPage } from "@/types";
import { IMAGE_CACHE_WORKER_BIND } from "../image-cache/types";

export { IMAGE_CACHE_WORKER_BIND };

/** 缩略图位图像素尺寸，和页条预览框一致。 */
export type PageThumbnailSize = {
  height: number;
  width: number;
};

/** 主线程请求画一页。 */
export type PageThumbnailRenderRequest = {
  page: CanvasPage;
  requestId: string;
  size: PageThumbnailSize;
  type: "render";
};

/** 成功时 transfer ImageBitmap 所有权给主线程。 */
export type PageThumbnailRenderSuccess = {
  bitmap: ImageBitmap;
  pageId: string;
  requestId: string;
  type: "rendered";
};

export type PageThumbnailRenderError = {
  error: string;
  pageId: string;
  requestId: string;
  type: "error";
};

/** 启动时绑定图片缓存 port，消息本身在 event.ports[0]。 */
export type PageThumbnailBindRequest = {
  type: typeof IMAGE_CACHE_WORKER_BIND;
};

export type PageThumbnailWorkerRequest = PageThumbnailBindRequest | PageThumbnailRenderRequest;

export type PageThumbnailWorkerResponse = PageThumbnailRenderSuccess | PageThumbnailRenderError;
