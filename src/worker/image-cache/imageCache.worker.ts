/**
 * 图片缓存 Dedicated Worker。
 * 不自己被缩略图 `new Worker`：Dedicated Worker 一对一，只能由主线程创建，再用 MessageChannel 转交 port。
 */
import { resolveImageBlob } from "./cache";
import { IMAGE_CACHE_HOST_BIND } from "./types";
import type {
  ImageCacheClientRequest,
  ImageCacheClientResponse,
  ImageCacheHostMessage,
} from "./types";

type WorkerHost = {
  onmessage: ((event: MessageEvent<ImageCacheHostMessage>) => void) | null;
};

const workerHost = self as unknown as WorkerHost;

/** 沿绑定的客户端 port 回传结果；Blob 不 transfer。 */
const reply = (port: MessagePort, message: ImageCacheClientResponse) => {
  port.postMessage(message);
};

/** 走三级缓存取 Blob，成功或失败都用同一个 requestId 回复。 */
const handleGet = async (request: ImageCacheClientRequest, port: MessagePort) => {
  try {
    const result = await resolveImageBlob(request.url, request.fetchInit);

    reply(port, {
      blob: result.blob,
      requestId: request.requestId,
      source: result.source,
      type: "result",
      url: request.url,
    });
  } catch (error) {
    reply(port, {
      error: error instanceof Error ? error.message : String(error),
      requestId: request.requestId,
      type: "error",
      url: request.url,
    });
  }
};

/** 一条 MessagePort 对应一个调用方（主画布或某个缩略图 worker）。 */
const bindClientPort = (port: MessagePort | undefined) => {
  if (!port) return;

  port.onmessage = (event: MessageEvent<ImageCacheClientRequest>) => {
    if (event.data.type !== "get") return;

    void handleGet(event.data, port);
  };
  // 通过 postMessage 转交过来的 port 必须 start，否则收不到消息。
  port.start();
};

workerHost.onmessage = (event) => {
  if (event.data?.type !== IMAGE_CACHE_HOST_BIND) return;

  bindClientPort(event.ports[0]);
};
