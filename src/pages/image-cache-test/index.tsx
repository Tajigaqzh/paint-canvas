import { DeleteOutlined, ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageRequestResult, ImageRequestWorkerResponse } from "./types";
import "./index.less";

const TEST_IMAGE_URL = "http://localhost:6174/image.png";
const IMAGE_TEST_SERVER_RESET_URL = "http://localhost:6174/reset";
const IMAGE_TEST_SERVER_STATS_URL = "http://localhost:6174/stats";

type RequestState = ImageRequestResult | { error: string; source: "main" | "worker" } | null;

const formatResultType = (type: ResponseType) => type;

function ResultPanel({ result, title }: { result: RequestState; title: string }) {
  return (
    <section className="image-cache-test__panel">
      <h2>{title}</h2>
      {!result && <p className="image-cache-test__placeholder">尚未请求</p>}
      {result && "error" in result && <p className="image-cache-test__error">{result.error}</p>}
      {result && !("error" in result) && (
        <dl>
          <dt>响应类型</dt>
          <dd>{formatResultType(result.responseType)}</dd>
          <dt>缓存层级</dt>
          <dd>{result.cacheLevel ?? "未标记"}</dd>
          <dt>状态码</dt>
          <dd>{result.status}</dd>
          <dt>ok</dt>
          <dd>{String(result.ok)}</dd>
          <dt>耗时</dt>
          <dd>{result.elapsedMs}ms</dd>
        </dl>
      )}
    </section>
  );
}

function ImageCacheTest() {
  const workerRef = useRef<Worker | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mainResult, setMainResult] = useState<RequestState>(null);
  const [workerResult, setWorkerResult] = useState<RequestState>(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState("检查 service worker 状态中");
  const [serverRequestCount, setServerRequestCount] = useState<number | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./imageRequest.worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const waitForServiceWorkerController = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      setServiceWorkerStatus("当前浏览器不支持 service worker");
      return false;
    }

    await navigator.serviceWorker.ready;

    if (navigator.serviceWorker.controller) {
      setServiceWorkerStatus("service worker 已控制当前页面");
      return true;
    }

    setServiceWorkerStatus("等待 service worker 控制当前页面");

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
    setServiceWorkerStatus("service worker 已控制当前页面");

    return true;
  }, []);

  useEffect(() => {
    void waitForServiceWorkerController();
  }, [waitForServiceWorkerController]);

  const clearImageCache = async () => {
    if (!navigator.serviceWorker.controller) return false;

    const channel = new MessageChannel();
    const completed = new Promise<boolean>((resolve) => {
      channel.port1.onmessage = (event: MessageEvent<{ ok: boolean }>) => {
        resolve(event.data.ok);
      };
    });

    navigator.serviceWorker.controller.postMessage({ type: "clear-image-cache" }, [channel.port2]);

    return completed;
  };

  const resetTestServerStats = async () => {
    try {
      await fetch(IMAGE_TEST_SERVER_RESET_URL, {
        method: "POST",
        mode: "cors",
      });
    } catch {
      return false;
    }

    return true;
  };

  const refreshTestServerStats = async () => {
    try {
      const response = await fetch(IMAGE_TEST_SERVER_STATS_URL, {
        mode: "cors",
      });
      const stats = (await response.json()) as { count: number };

      setServerRequestCount(stats.count);
    } catch {
      setServerRequestCount(null);
    }
  };

  const requestFromMainThread = async (): Promise<RequestState> => {
    const startedAt = performance.now();

    try {
      const response = await fetch(TEST_IMAGE_URL, {
        cache: "default",
        mode: "cors",
      });

      return {
        cacheLevel: response.headers.get("X-Image-Cache-Level"),
        elapsedMs: Math.round(performance.now() - startedAt),
        ok: response.ok,
        responseType: response.type,
        source: "main",
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        source: "main",
      };
    }
  };

  const requestFromWorker = (requestId: string) =>
    new Promise<RequestState>((resolve) => {
      const worker = workerRef.current;

      if (!worker) {
        resolve({
          error: "worker 未初始化",
          source: "worker",
        });
        return;
      }

      const handleMessage = (event: MessageEvent<ImageRequestWorkerResponse>) => {
        const response = event.data;

        if (response.requestId !== requestId) return;

        worker.removeEventListener("message", handleMessage);

        if (response.type === "error") {
          resolve({
            error: response.error,
            source: "worker",
          });
          return;
        }

        resolve(response);
      };

      worker.addEventListener("message", handleMessage);
      worker.postMessage({
        requestId,
        url: TEST_IMAGE_URL,
      });
    });

  const runRequests = async (clearCacheFirst: boolean) => {
    setIsRunning(true);
    setMainResult(null);
    setWorkerResult(null);

    const isControlled = await waitForServiceWorkerController();

    if (!isControlled) {
      setIsRunning(false);
      return;
    }

    if (clearCacheFirst) {
      await clearImageCache();
      await resetTestServerStats();
    }

    const requestId = `image-cache-test-${Date.now()}`;
    const [nextMainResult, nextWorkerResult] = await Promise.all([
      requestFromMainThread(),
      requestFromWorker(requestId),
    ]);

    setMainResult(nextMainResult);
    setWorkerResult(nextWorkerResult);
    await refreshTestServerStats();
    setIsRunning(false);
  };

  return (
    <main className="image-cache-test">
      <div className="image-cache-test__shell">
        <header className="image-cache-test__header">
          <h1>图片缓存请求测试</h1>
          <p>并行从主线程和 Web Worker 请求同一个跨域 PNG，用 Network 面板观察真实网络请求数量。</p>
        </header>

        <div className="image-cache-test__url">{TEST_IMAGE_URL}</div>

        <div className="image-cache-test__actions">
          <Button
            icon={<DeleteOutlined />}
            loading={isRunning}
            type="primary"
            onClick={() => void runRequests(true)}
          >
            清缓存并请求
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            loading={isRunning}
            onClick={() => void runRequests(false)}
          >
            直接请求
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新页面
          </Button>
          <span className="image-cache-test__status">{serviceWorkerStatus}</span>
          <span className="image-cache-test__status">
            服务端真实 GET：{serverRequestCount ?? "未读取"}
          </span>
        </div>

        <div className="image-cache-test__grid">
          <ResultPanel result={mainResult} title="主线程 fetch" />
          <ResultPanel result={workerResult} title="Worker fetch" />
        </div>

        <p className="image-cache-test__note">
          冷缓存时点击“清缓存并请求”，两个 fetch 会同时命中 service
          worker。热缓存时点击“直接请求”，应从 service worker 的内存 LRU 或 IndexedDB
          返回，不再访问远端图片。服务端真实请求数看 http://localhost:6174/stats。
        </p>
      </div>
    </main>
  );
}

export default ImageCacheTest;
