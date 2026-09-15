import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasToolMode, EditableLeaferApp, UseLeaferCanvasOptions } from "@/types";
import { useMagnifier } from "../useMagnifier";

const mockMagnifier = vi.hoisted(() => ({
  dispose: vi.fn(),
  instances: [] as Array<{ app: unknown; config: Record<string, unknown> }>,
  set: vi.fn(),
}));

vi.mock("leafer-x-magnifier", () => ({
  Magnifier: class {
    dispose = mockMagnifier.dispose;
    set = mockMagnifier.set;

    constructor(app: unknown, config: Record<string, unknown>) {
      mockMagnifier.instances.push({ app, config });
    }
  },
}));

/** app 是 Leafer 边界，容器是普通 DOM，这里只关心 hook 传了什么。 */
const app = { isApp: true } as unknown as EditableLeaferApp;
const container = document.createElement("div");

type Tool = UseLeaferCanvasOptions["tool"];

const createTool = (mode: CanvasToolMode, size = 200, zoom = 3): Tool => ({
  brushSize: 8,
  eraserSize: 24,
  magnifierSize: size,
  magnifierZoom: zoom,
  mode,
});

const renderMagnifier = ({
  mode = "brush" as CanvasToolMode,
  size = 200,
  zoom = 3,
  withApp = true,
} = {}) => {
  const toolRef = { current: createTool(mode, size, zoom) };

  return renderHook(
    ({ tool }: { tool: Tool }) =>
      useMagnifier({
        appRef: { current: withApp ? app : null },
        magnifierContainerRef: { current: container },
        tool,
        toolRef,
      }),
    { initialProps: { tool: toolRef.current } },
  );
};

beforeEach(() => {
  mockMagnifier.dispose.mockClear();
  mockMagnifier.instances.length = 0;
  mockMagnifier.set.mockClear();
});

describe("useMagnifier", () => {
  it("把 app 和镜片定位容器交给插件，初始参数取当前工具状态", () => {
    renderMagnifier({ mode: "magnifier", size: 320, zoom: 6 });

    expect(mockMagnifier.instances).toEqual([
      {
        app,
        config: { container, enabled: true, size: 320, zoom: 6 },
      },
    ]);
  });

  it("非放大镜工具时初始为禁用", () => {
    renderMagnifier({ mode: "brush" });

    expect(mockMagnifier.instances[0].config).toMatchObject({ enabled: false, size: 200, zoom: 3 });
  });

  it("切换工具时同步 enabled", () => {
    const { rerender } = renderMagnifier({ mode: "brush" });

    mockMagnifier.set.mockClear();
    rerender({ tool: createTool("magnifier") });

    expect(mockMagnifier.set).toHaveBeenCalledWith({ enabled: true, size: 200, zoom: 3 });
  });

  it("修改直径和倍数时同步给插件", () => {
    const { rerender } = renderMagnifier({ mode: "magnifier" });

    mockMagnifier.set.mockClear();
    rerender({ tool: createTool("magnifier", 120, 8) });

    expect(mockMagnifier.set).toHaveBeenCalledWith({ enabled: true, size: 120, zoom: 8 });
  });

  it("App 还没就绪时不创建插件", () => {
    renderMagnifier({ withApp: false });

    expect(mockMagnifier.instances).toHaveLength(0);
    expect(mockMagnifier.set).not.toHaveBeenCalled();
  });

  it("卸载时销毁插件", () => {
    const { unmount } = renderMagnifier();

    unmount();

    expect(mockMagnifier.dispose).toHaveBeenCalled();
  });
});
