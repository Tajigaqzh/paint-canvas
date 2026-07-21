import type { ImageRequestWorkerRequest, ImageRequestWorkerResponse } from "./types";

type WorkerPort = {
  onmessage: ((event: MessageEvent<ImageRequestWorkerRequest>) => void) | null;
  postMessage(message: ImageRequestWorkerResponse): void;
};

const workerPort = self as unknown as WorkerPort;

workerPort.onmessage = async (event) => {
  const { requestId, url } = event.data;
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      cache: "default",
      mode: "cors",
    });

    workerPort.postMessage({
      cacheLevel: response.headers.get("X-Image-Cache-Level"),
      elapsedMs: Math.round(performance.now() - startedAt),
      ok: response.ok,
      responseType: response.type,
      requestId,
      source: "worker",
      status: response.status,
      type: "complete",
    });
  } catch (error) {
    workerPort.postMessage({
      error: error instanceof Error ? error.message : String(error),
      requestId,
      source: "worker",
      type: "error",
    });
  }
};
