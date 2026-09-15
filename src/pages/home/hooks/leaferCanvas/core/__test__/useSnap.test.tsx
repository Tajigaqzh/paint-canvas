import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Frame } from "leafer-ui";
import type { CanvasToolMode, EditableLeaferApp, UseLeaferCanvasOptions } from "@/types";
import { useSnap } from "../useSnap";

const mockSnap = vi.hoisted(() => ({
  enable: vi.fn(),
  instances: [] as Array<{ app: unknown; config: Record<string, unknown> }>,
  updateConfig: vi.fn(),
}));

vi.mock("leafer-x-easy-snap", () => ({
  Snap: class {
    enable = mockSnap.enable;
    updateConfig = mockSnap.updateConfig;

    constructor(app: unknown, config: Record<string, unknown>) {
      mockSnap.instances.push({ app, config });
    }
  },
}));

/** app / board 是 Leafer 边界，这里只关心 hook 传了什么。 */
const app = { isApp: true, tree: { scale: 0.5 } } as unknown as EditableLeaferApp;
const board = { name: "board" } as unknown as Frame;
const viewSize = { height: 580, width: 684 };

const createTool = (mode: CanvasToolMode): UseLeaferCanvasOptions["tool"] => ({
  brushSize: 8,
  eraserSize: 24,
  magnifierSize: 200,
  magnifierZoom: 3,
  mode,
});

const renderSnap = (
  { mode = "select", withBoard = true } = {} as {
    mode?: CanvasToolMode;
    withBoard?: boolean;
  },
) =>
  renderHook(
    ({ tool }: { tool: UseLeaferCanvasOptions["tool"] }) =>
      useSnap({
        appRef: { current: app },
        boardRef: { current: withBoard ? board : null },
        tool,
        viewSize,
      }),
    { initialProps: { tool: createTool(mode) } },
  );

beforeEach(() => {
  mockSnap.enable.mockClear();
  mockSnap.instances.length = 0;
  mockSnap.updateConfig.mockClear();
});

describe("useSnap", () => {
  it("用 board 作为吸附父容器，并关掉距离标签和等间距提示", () => {
    renderSnap();

    expect(mockSnap.instances).toHaveLength(1);
    expect(mockSnap.instances[0]).toEqual({
      app,
      config: {
        parentContainer: board,
        showDistanceLabels: false,
        showEqualSpacingBoxes: false,
      },
    });
  });

  it("按 app.tree 的显示缩放把吸附范围换算成画板像素", () => {
    renderSnap();

    // 屏幕 5px 在 0.5 倍缩放下等于 10 个画板像素。
    expect(mockSnap.updateConfig).toHaveBeenCalledWith({ snapSize: 10 });
  });

  it("select 模式下开启吸附", () => {
    renderSnap({ mode: "select" });

    expect(mockSnap.enable).toHaveBeenCalledWith(true);
  });

  it("brush 模式下关闭吸附", () => {
    const { rerender } = renderSnap({ mode: "select" });

    mockSnap.enable.mockClear();
    rerender({ tool: createTool("brush") });

    expect(mockSnap.enable).toHaveBeenCalledWith(false);
  });

  it("eraser 模式下关闭吸附", () => {
    const { rerender } = renderSnap({ mode: "select" });

    mockSnap.enable.mockClear();
    rerender({ tool: createTool("eraser") });

    expect(mockSnap.enable).toHaveBeenCalledWith(false);
  });

  it("magnifier 模式下关闭吸附", () => {
    const { rerender } = renderSnap({ mode: "select" });

    mockSnap.enable.mockClear();
    rerender({ tool: createTool("magnifier") });

    expect(mockSnap.enable).toHaveBeenCalledWith(false);
  });

  it("board 未就绪时不创建吸附实例", () => {
    renderSnap({ withBoard: false });

    expect(mockSnap.instances).toHaveLength(0);
    expect(mockSnap.enable).not.toHaveBeenCalled();
  });

  it("卸载时关闭吸附", () => {
    const { unmount } = renderSnap();

    mockSnap.enable.mockClear();
    unmount();

    expect(mockSnap.enable).toHaveBeenCalledWith(false);
  });
});
