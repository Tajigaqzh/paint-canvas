import type { CanvasPage } from "@/types";
import type { ThumbnailRenderSize, ThumbnailWorkerRequest, ThumbnailWorkerResponse } from "./types";

type RenderPageResult = {
  bitmap?: ImageBitmap;
  error?: string;
  pageId: string;
};

type RenderJob = {
  reject(error: Error): void;
  request: ThumbnailWorkerRequest;
  resolve(result: RenderPageResult): void;
};

type ManagedWorker = {
  activeJob?: RenderJob;
  instance: Worker;
};

const createRequestId = () => `thumbnail-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getWorkerCount = () => {
  const hardwareCount = window.navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(3, hardwareCount - 1 || 1));
};

export class CanvasThumbnailWorkerManager {
  private readonly queue: RenderJob[] = [];

  private readonly workers: ManagedWorker[];

  private disposed = false;

  constructor(workerCount = getWorkerCount()) {
    this.workers = Array.from({ length: workerCount }, () => {
      const worker: ManagedWorker = {
        instance: new Worker(new URL("./renderer.worker.ts", import.meta.url), {
          type: "module",
        }),
      };

      worker.instance.onmessage = (event: MessageEvent<ThumbnailWorkerResponse>) => {
        this.handleWorkerMessage(worker, event.data);
      };
      worker.instance.onerror = () => {
        this.handleWorkerError(worker, new Error("缩略图 worker 渲染失败"));
      };

      return worker;
    });
  }

  renderPages(pages: CanvasPage[], size: ThumbnailRenderSize) {
    return Promise.all(pages.map((page) => this.renderPage(page, size)));
  }

  terminate() {
    this.disposed = true;
    this.queue.splice(0).forEach((job) => {
      job.reject(new Error("缩略图 worker 已关闭"));
    });
    this.workers.forEach((worker) => {
      worker.instance.terminate();
    });
  }

  private renderPage(page: CanvasPage, size: ThumbnailRenderSize) {
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

  private handleWorkerMessage(worker: ManagedWorker, response: ThumbnailWorkerResponse) {
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
