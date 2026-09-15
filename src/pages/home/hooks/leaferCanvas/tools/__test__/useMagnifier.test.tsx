import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EditableLeaferApp, UseLeaferCanvasOptions } from "@/types";
import { useMagnifier } from "../useMagnifier";

type MagnifierTool = UseLeaferCanvasOptions["tool"];

const toRect = (left: number, top: number, width: number, height: number) =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top,
  }) as DOMRect;

const createContext = () => ({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "",
});

/** 镜片画布和它外层容器都是 Leafer / DOM 边界，用假对象替代。 */
const createLens = () => {
  const context = createContext();
  // 镜片挂在 (40, 30) 的容器里，来源画布从 (0, 0) 开始铺满 960 x 540。
  const host = { getBoundingClientRect: () => toRect(40, 30, 960, 540) };
  const lens = {
    height: 0,
    parentElement: host,
    style: { display: "", height: "", left: "", top: "", width: "" },
    width: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  return { context, lens };
};

const createSource = () =>
  ({
    height: 540,
    width: 960,
    getBoundingClientRect: () => toRect(0, 0, 960, 540),
  }) as unknown as HTMLCanvasElement;

const createTool = (mode: MagnifierTool["mode"]): MagnifierTool => ({
  brushSize: 8,
  eraserSize: 24,
  magnifierSize: 200,
  magnifierZoom: 2,
  mode,
});

const dispatchPointerMove = (view: HTMLElement, clientX: number, clientY: number) => {
  const event = new Event("pointermove", { bubbles: true });

  Object.assign(event, { clientX, clientY });
  view.dispatchEvent(event);
};

const renderMagnifier = (mode: MagnifierTool["mode"], app: EditableLeaferApp | null) => {
  const { context, lens } = createLens();
  const source = createSource();
  const view = document.createElement("div");
  const appRef = {
    current: app ?? ({ tree: { canvas: { view: source } } } as unknown as EditableLeaferApp),
  };
  const toolRef = { current: createTool(mode) };

  const result = renderHook(() =>
    useMagnifier({
      appRef,
      magnifierCanvasRef: { current: lens },
      tool: toolRef.current,
      toolRef,
      viewRef: { current: view },
    }),
  );

  return { context, lens, result, source, toolRef, view };
};

describe("useMagnifier", () => {
  it("放大镜模式下 pointermove 把取样区域放大到镜片并跟随指针定位", () => {
    const { context, lens, source, view } = renderMagnifier("magnifier", null);

    dispatchPointerMove(view, 200, 150);

    // lensSize 200 / zoom 2 = 100 设备像素取样，中心落在指针 (200, 150) 上。
    expect(context.drawImage).toHaveBeenCalledWith(source, 150, 100, 100, 100, 0, 0, 200, 200);
    expect(lens.style.display).toBe("block");
    expect(lens.style.width).toBe("200px");
    expect(lens.style.height).toBe("200px");
    // 镜片中心压在指针上：200 - 40 - 100 / 150 - 30 - 100。
    expect(lens.style.left).toBe("60px");
    expect(lens.style.top).toBe("20px");
  });

  it("非放大镜工具时 pointermove 不绘制", () => {
    const { context, lens, view } = renderMagnifier("brush", null);

    dispatchPointerMove(view, 200, 150);

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(lens.style.display).toBe("none");
  });

  it("切走放大镜工具后收起镜片", () => {
    const { lens, result, toolRef } = renderMagnifier("magnifier", null);

    toolRef.current = createTool("eraser");
    result.rerender();

    expect(lens.style.display).toBe("none");
  });

  it("指针离开画布时收起镜片", () => {
    const { lens, view } = renderMagnifier("magnifier", null);

    dispatchPointerMove(view, 200, 150);
    view.dispatchEvent(new Event("pointerleave"));

    expect(lens.style.display).toBe("none");
  });

  it("App 未初始化时 pointermove 直接返回，不抛错", () => {
    const { context, lens, view } = renderMagnifier("magnifier", {} as EditableLeaferApp);

    expect(() => dispatchPointerMove(view, 200, 150)).not.toThrow();
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(lens.style.display).toBe("");
  });

  it("卸载后不再响应 pointermove", () => {
    const { context, lens, result, view } = renderMagnifier("magnifier", null);

    result.unmount();
    dispatchPointerMove(view, 200, 150);

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(lens.style.display).toBe("none");
  });
});
