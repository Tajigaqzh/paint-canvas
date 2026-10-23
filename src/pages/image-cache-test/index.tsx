import { DeleteOutlined, ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import type { ImageRequestResult, ImageRequestWorkerResponse } from "./types";
import "./index.less";

const TEST_IMAGE_URL = "http://localhost:6174/image.png";
const IMAGE_TEST_SERVER_RESET_URL = "http://localhost:6174/reset";
const IMAGE_TEST_SERVER_STATS_URL = "http://localhost:6174/stats";

type RequestState = ImageRequestResult | { error: string; source: "main" | "worker" } | null;

const formatResultType = (type: ResponseType) => type;

function ResultPanel({ result, title }: { result: RequestState; title: string }) {
  const { t } = useAppTranslation();
  return (
    <section className="image-cache-test__panel">
      <h2>{title}</h2>
      {!result && <p className="image-cache-test__placeholder">{t("notRequested")}</p>}
      {result && "error" in result && <p className="image-cache-test__error">{result.error}</p>}
      {result && !("error" in result) && (
        <dl>
          <dt>{t("responseType")}</dt>
          <dd>{formatResultType(result.responseType)}</dd>
          <dt>{t("cacheLevel")}</dt>
          <dd>{result.cacheLevel ?? t("notReported")}</dd>
          <dt>{t("status")}</dt>
          <dd>{result.status}</dd>
          <dt>ok</dt>
          <dd>{String(result.ok)}</dd>
          <dt>{t("elapsed")}</dt>
          <dd>{result.elapsedMs}ms</dd>
        </dl>
      )}
    </section>
  );
}

function ImageCacheTest() {
  const { t } = useAppTranslation();
  const workerRef = useRef<Worker | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mainResult, setMainResult] = useState<RequestState>(null);
  const [workerResult, setWorkerResult] = useState<RequestState>(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState("checkingServiceWorkerStatus");
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
      setServiceWorkerStatus("serviceWorkerUnsupported");
      return false;
    }

    await navigator.serviceWorker.ready;

    if (navigator.serviceWorker.controller) {
      setServiceWorkerStatus("serviceWorkerControlsThisPage");
      return true;
    }

    setServiceWorkerStatus("waitingForServiceWorkerControl");

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
    setServiceWorkerStatus("serviceWorkerControlsThisPage");

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
          <div><h1>{t("imageCacheRequestTest")}</h1><LanguageSwitcher /></div>
          <p>{t("cacheConcurrencyHint")}</p>
        </header>

        <div className="image-cache-test__url">{TEST_IMAGE_URL}</div>

        <div className="image-cache-test__actions">
          <Button
            icon={<DeleteOutlined />}
            loading={isRunning}
            type="primary"
            onClick={() => void runRequests(true)}
          >
            {t("clearCacheAndRequest")}
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            loading={isRunning}
            onClick={() => void runRequests(false)}
          >
            {t("requestDirectly")}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            {t("refreshPage")}
          </Button>
          <span className="image-cache-test__status">{t(serviceWorkerStatus)}</span>
          <span className="image-cache-test__status">
            {t("serverGetRequests")}：{serverRequestCount ?? t("notRead")}
          </span>
        </div>

        <div className="image-cache-test__grid">
          <ResultPanel result={mainResult} title={t("mainThreadFetch")} />
          <ResultPanel result={workerResult} title={t("workerFetch")} />
        </div>

        <p className="image-cache-test__note">
          {t("cacheTestHint")}
        </p>
      </div>
    </main>
  );
}

export default ImageCacheTest;
