import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFullscreen } from "../useFullscreen";

describe("useFullscreen", () => {
  afterEach(() => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    vi.restoreAllMocks();
  });

  it("未全屏时切换会请求容器进入全屏", () => {
    const element = document.createElement("div");
    const requestFullscreen = vi.fn(() => Promise.resolve());
    element.requestFullscreen = requestFullscreen;
    const { result } = renderHook(() => useFullscreen({ current: element }));

    act(() => result.current.toggleFullscreen());

    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("全屏时切换会退出全屏", () => {
    const exitFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.body,
    });
    document.exitFullscreen = exitFullscreen;
    const { result } = renderHook(() => useFullscreen({ current: document.createElement("div") }));

    act(() => result.current.toggleFullscreen());

    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("fullscreenchange 后同步当前全屏状态", () => {
    const { result } = renderHook(() => useFullscreen({ current: null }));
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.body,
    });

    act(() => document.dispatchEvent(new Event("fullscreenchange")));

    expect(result.current.isFullscreen).toBe(true);
  });
});
