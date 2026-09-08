/**
 * 主线程缩略图调度：维护最多 3 个 Dedicated Worker 的队列。
 * 每个 worker 同时只跑一页；启动时立刻 bind 图片缓存 port。
 */
import type { CanvasPage } from "@/types";
import { getImageCacheWorkerManager } from "@/worker/image-cache";
import type {
  PageThumbnailRenderRequest,
  PageThumbnailSize,
  PageThumbnailWorkerResponse,
} from "./types";

type RenderPageResult = {
  bitmap?: ImageBitmap;
  error?: string;
  pageId: string;
};

type RenderJob = {
  reject(error: Error): void;
  request: PageThumbnailRenderRequest;
  resolve(result: RenderPageResult): void;
};

type ManagedWorker = {
  activeJob?: RenderJob;
  instance: Worker;
};

const MAX_WORKER_COUNT = 3;

const createRequestId = () => `page-thumbnail-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** 根据机器性能估算 worker 数量，最多 3 个，避免占用过多线程。 */
const getWorkerCount = () => {
  const hardwareCount = window.navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(MAX_WORKER_COUNT, hardwareCount - 1 || 1));
};

const createWorker = () =>
  new Worker(new URL("./pageThumbnail.worker.ts", import.meta.url), {
    type: "module",
  });

/**
 * 缩略图 worker 任务调度器。
 * 把页面渲染请求放进队列，分发给空闲 worker；每个 worker 同时只跑一个任务。
 */
export class PageThumbnailWorkerManager {
  private readonly queue: RenderJob[] = [];

  private readonly workers: ManagedWorker[];

  private disposed = false;

  constructor(workerCount = getWorkerCount()) {
    this.workers = Array.from({ length: workerCount }, () => this.createManagedWorker());
  }

  /** 并行入队多页；实际绘制仍按空闲 worker 逐个消费。 */
  renderPages(pages: CanvasPage[], size: PageThumbnailSize) {
    return Promise.all(pages.map((page) => this.enqueuePage(page, size)));
  }

  /** 停止调度并 terminate 所有 worker，队列里未完成的任务会 reject。 */
  terminate() {
    this.disposed = true;
    this.queue.splice(0).forEach((job) => {
      job.reject(new Error("缩略图 worker 已关闭"));
    });
    this.workers.forEach((worker) => {
      worker.instance.terminate();
    });
  }

  private createManagedWorker() {
    const worker: ManagedWorker = {
      instance: createWorker(),
    };

    worker.instance.onmessage = (event: MessageEvent<PageThumbnailWorkerResponse>) => {
      this.handleWorkerMessage(worker, event.data);
    };
    worker.instance.onerror = () => {
      this.handleWorkerError(worker, new Error("缩略图 worker 渲染失败"));
    };

    getImageCacheWorkerManager().bindToWorker(worker.instance);

    return worker;
  }

  private enqueuePage(page: CanvasPage, size: PageThumbnailSize) {
    return new Promise<RenderPageResult>((resolve, reject) => {
      this.queue.push({
        reject,
        request: {
          page,
          requestId: createRequestId(),
          size,
          type: "render",
        },
        resolve,
      });
      this.flushQueue();
    });
  }

  /** 空闲 worker 立刻取队列头；没有空闲则等当前任务回调后再 flush。 */
  private flushQueue() {
    if (this.disposed) return;

    this.workers.forEach((worker) => {
      if (worker.activeJob || this.queue.length === 0) return;

      const job = this.queue.shift();

      if (!job) return;

      worker.activeJob = job;
      worker.instance.postMessage(job.request);
    });
  }

  private handleWorkerMessage(worker: ManagedWorker, response: PageThumbnailWorkerResponse) {
    const job = worker.activeJob;

    worker.activeJob = undefined;

    if (!job) {
      this.flushQueue();
      return;
    }

    if (response.requestId !== job.request.requestId) {
      job.reject(new Error("缩略图 worker 返回了过期任务"));
    } else if (response.type === "error") {
      job.resolve({
        error: response.error,
        pageId: response.pageId,
      });
    } else {
      job.resolve({
        bitmap: response.bitmap,
        pageId: response.pageId,
      });
    }

    this.flushQueue();
  }

  private handleWorkerError(worker: ManagedWorker, error: Error) {
    const job = worker.activeJob;

    worker.activeJob = undefined;
    job?.reject(error);
    this.flushQueue();
  }
}
