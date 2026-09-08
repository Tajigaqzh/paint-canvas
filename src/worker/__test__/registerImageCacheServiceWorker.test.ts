import { describe, expect, it, vi } from "vitest";
import { registerImageCacheServiceWorker } from "../registerImageCacheServiceWorker";

describe("registerImageCacheServiceWorker", () => {
  it("存在 serviceWorker 时在 load 后 register", () => {
    const register = vi.fn();
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerImageCacheServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledWith("/image-cache-sw.js", { scope: "/" });
  });
});
