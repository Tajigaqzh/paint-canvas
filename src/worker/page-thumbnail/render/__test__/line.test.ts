import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasNode } from "@/types";
import type { RenderContext } from "../types";
import { getTransformedLineBounds, renderLineNode } from "../line";

const createContext = (transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) => {
  const calls: unknown[][] = [];
  const context = {
    beginPath: vi.fn(() => calls.push(["beginPath"])),
    bezierCurveTo: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => calls.push(["drawImage", ...args])),
    getTransform: vi.fn(() => transform),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(() => calls.push(["restore"])),
    save: vi.fn(() => calls.push(["save"])),
    setLineDash: vi.fn(),
    setTransform: vi.fn((...args: unknown[]) => calls.push(["setTransform", ...args])),
    stroke: vi.fn(() => calls.push(["stroke"])),
  };

  return { calls, context: context as unknown as RenderContext };
};

const lineNode = (eraserPaths: Extract<CanvasNode, { kind: "line" }>["eraserPaths"] = []) =>
  ({
    animationList: [],
    curve: false,
    eraserPaths,
    height: 10,
    id: "line-1",
    kind: "line",
    name: "Line",
    points: [0, 5, 100, 5],
    rotation: 0,
    stroke: "#111827",
    strokeCap: "round",
    strokeStyle: "solid",
    strokeWidth: 8,
    transformOrigin: "top-left",
    width: 100,
    x: 0,
    y: 0,
  }) satisfies Extract<CanvasNode, { kind: "line" }>;

describe("getTransformedLineBounds", () => {
  it("把缩放和平移后的局部范围转换成带抗锯齿边距的像素范围", () => {
    expect(
      getTransformedLineBounds(
        { height: 20, minX: 0, minY: 0, width: 100 },
        { a: 0.5, b: 0, c: 0, d: 0.5, e: 10, f: 20 },
      ),
    ).toEqual({ height: 14, minX: 8, minY: 18, width: 54 });
  });

  it("旋转后仍包住全部四个角", () => {
    const bounds = getTransformedLineBounds(
      { height: 10, minX: 0, minY: 0, width: 20 },
      { a: 0, b: 1, c: -1, d: 0, e: 30, f: 40 },
    );

    expect(bounds).toEqual({ height: 24, minX: 18, minY: 38, width: 14 });
  });
});

describe("renderLineNode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("没有擦除轨迹时直接绘制原始笔迹", () => {
    const { context } = createContext();
    const offscreen = vi.fn();
    vi.stubGlobal("OffscreenCanvas", offscreen);

    renderLineNode(context, lineNode());

    expect(context.stroke).toHaveBeenCalledOnce();
    expect(offscreen).not.toHaveBeenCalled();
  });

  it("在缩略图像素变换下栅格化原线和擦除轨迹", () => {
    const transform = { a: 0.5, b: 0, c: 0, d: 0.5, e: 10, f: 20 };
    const { calls, context } = createContext(transform);
    const layerContext = createContext().context;
    let layerSize: [number, number] = [0, 0];
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(width: number, height: number) {
          layerSize = [width, height];
        }

        getContext() {
          return layerContext;
        }
      },
    );

    renderLineNode(context, lineNode([{ points: [50, 5, 60, 5], strokeWidth: 20 }]));

    expect(layerSize[0]).toBeGreaterThan(0);
    expect(layerSize[1]).toBeGreaterThan(0);
    expect(layerContext.setTransform).toHaveBeenCalledWith(
      0.5,
      0,
      0,
      0.5,
      transform.e - (calls.find((call) => call[0] === "drawImage")?.[2] as number),
      transform.f - (calls.find((call) => call[0] === "drawImage")?.[3] as number),
    );
    expect(layerContext.stroke).toHaveBeenCalledTimes(2);
    expect(context.drawImage).toHaveBeenCalledOnce();
  });
});
