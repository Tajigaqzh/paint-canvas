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

/** 生成每个缩略图任务的唯一 requestId，用来把 worker 返回和当前任务对上。 */
const createRequestId = () => `thumbnail-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** 根据机器性能估算 worker 数量，避免一次性拉起过多线程。最大开启3个，避免过多占用线程 */
const getWorkerCount = () => {
  const hardwareCount = window.navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(3, hardwareCount - 1 || 1));
};

/**
 * 缩略图 worker 任务调度器。
 * 负责把页面渲染请求放进队列、分发给空闲 worker，并在任务结束后继续派发后续请求。
 */
export class CanvasThumbnailWorkerManager {
  private readonly queue: RenderJob[] = [];

  private readonly workers: ManagedWorker[];

  private disposed = false;

  constructor(workerCount = getWorkerCount()) {
    // 每个 worker 只处理一个任务；完成后再从队列里取下一个。
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

  /** 批量渲染多个页面的缩略图。 */
  renderPages(pages: CanvasPage[], size: ThumbnailRenderSize) {
    return Promise.all(pages.map((page) => this.renderPage(page, size)));
  }

  /** 停止调度并终止所有 worker，未完成任务会直接失败。 */
  terminate() {
    this.disposed = true;
    this.queue.splice(0).forEach((job) => {
      job.reject(new Error("缩略图 worker 已关闭"));
    });
    this.workers.forEach((worker) => {
      worker.instance.terminate();
    });
  }

  /** 把单个页面渲染请求入队，并由空闲 worker 异步执行。 */
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

  /**
   * 向空闲 worker 派发任务。
   * 只要还有空闲 worker 和待处理任务，就持续消费队列。
   */
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

  /** 处理 worker 的正常返回，并把结果回填给对应的渲染任务。 */
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

  /** 处理 worker 异常退出或脚本报错。 */
  private handleWorkerError(worker: ManagedWorker, error: Error) {
    const job = worker.activeJob;

    worker.activeJob = undefined;
    job?.reject(error);
    this.flushQueue();
  }
}
