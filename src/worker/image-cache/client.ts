import type {
  ImageBlobResult,
  ImageCacheClientRequest,
  ImageCacheClientResponse,
  ImageCacheFetchInit,
} from "./types";

type PendingRequest = {
  reject(error: Error): void;
  resolve(result: ImageBlobResult): void;
};

const createRequestId = () => `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * 主线程和缩略图 worker 共用的图片缓存客户端。
 * 只通过 MessagePort 向图片线程要 Blob，自己不发网络请求。
 */
export class ImageCachePortClient {
  /** requestId → 等待中的 Promise，收到 result/error 后兑现。 */
  private readonly pending = new Map<string, PendingRequest>();

  private readonly port: MessagePort;

  constructor(port: MessagePort) {
    this.port = port;
    this.port.onmessage = (event: MessageEvent<ImageCacheClientResponse>) => {
      this.handleResponse(event.data);
    };
    this.port.start();
  }

  /** 请求指定 URL 的 Blob；同一客户端可并发多个 get。 */
  getBlob(url: string, fetchInit?: ImageCacheFetchInit) {
    const requestId = createRequestId();
    const request: ImageCacheClientRequest = {
      fetchInit,
      requestId,
      type: "get",
      url,
    };

    return new Promise<ImageBlobResult>((resolve, reject) => {
      this.pending.set(requestId, { reject, resolve });
      this.port.postMessage(request);
    });
  }

  private handleResponse(response: ImageCacheClientResponse) {
    const pending = this.pending.get(response.requestId);

    if (!pending) return;

    this.pending.delete(response.requestId);

    if (response.type === "error") {
      pending.reject(new Error(response.error));
      return;
    }

    pending.resolve({
      blob: response.blob,
      source: response.source,
    });
  }
}
