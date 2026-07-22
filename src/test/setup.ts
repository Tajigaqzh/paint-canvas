import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({
    addEventListener: () => {},
    addListener: () => {},
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => {},
    removeListener: () => {},
  }),
  writable: true,
});

class MockResizeObserver {
  disconnect() {}

  observe() {}

  unobserve() {}
}

class MockWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  addEventListener() {}

  postMessage(message: unknown) {
    const request = message as {
      page?: {
        id?: string;
      };
      requestId?: string;
    };

    queueMicrotask(() => {
      this.onmessage?.(
        new MessageEvent("message", {
          data: {
            bitmap: {
              close: () => {},
              height: 78,
              width: 138,
            },
            pageId: request.page?.id ?? "",
            requestId: request.requestId,
            type: "rendered",
          },
        }),
      );
    });
  }

  removeEventListener() {}

  terminate() {}
}

Object.defineProperty(window, "ResizeObserver", {
  value: MockResizeObserver,
  writable: true,
});
Object.defineProperty(globalThis, "ResizeObserver", {
  value: MockResizeObserver,
  writable: true,
});
Object.defineProperty(window, "Worker", {
  value: MockWorker,
  writable: true,
});
Object.defineProperty(globalThis, "Worker", {
  value: MockWorker,
  writable: true,
});
