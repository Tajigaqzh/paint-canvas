import { describe, expect, it, vi } from "vitest";
import { ImageCachePortClient } from "../client";

type PortMessage = { requestId: string; type: string; url: string };

const createPort = (mode: "result" | "error") => {
  const port: {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: PortMessage) => void;
    start: () => void;
  } = {
    onmessage: null,
    postMessage: (message) => {
      queueMicrotask(() => {
        if (mode === "error") {
          port.onmessage?.(
            new MessageEvent("message", {
              data: {
                error: "boom",
                requestId: message.requestId,
                type: "error",
                url: message.url,
              },
            }),
          );
          return;
        }

        port.onmessage?.(
          new MessageEvent("message", {
            data: {
              blob: new Blob(["img"]),
              requestId: message.requestId,
              source: "memory",
              type: "result",
              url: message.url,
            },
          }),
        );
      });
    },
    start: vi.fn(),
  };

  return port;
};

describe("ImageCachePortClient", () => {
  it("构造时会 start port", () => {
    const port = createPort("result");
    new ImageCachePortClient(port as unknown as MessagePort);
    expect(port.start).toHaveBeenCalled();
  });

  it("成功回包得到 blob", async () => {
    const port = createPort("result");
    const client = new ImageCachePortClient(port as unknown as MessagePort);
    const result = await client.getBlob("https://example.com/a.png");
    expect(result.source).toBe("memory");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("错误回包会 reject", async () => {
    const port = createPort("error");
    const client = new ImageCachePortClient(port as unknown as MessagePort);
    await expect(client.getBlob("https://example.com/a.png")).rejects.toThrow("boom");
  });
});
