import { describe, expect, it, vi } from "vitest";
import type { MagnifierLensCanvas } from "../src";
import { drawMagnifierLens, getMagnifierSample } from "../src";

const createContext = () => ({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "",
});

describe("getMagnifierSample", () => {
  it("按倍率反推取样边长，并以指针为取样中心", () => {
    expect(getMagnifierSample({ x: 120, y: 80 }, 200, 2, 1)).toEqual({
      sh: 100,
      sw: 100,
      sx: 70,
      sy: 30,
    });
  });

  it("倍率越高取样区域越小", () => {
    expect(getMagnifierSample({ x: 120, y: 80 }, 200, 4, 1)).toEqual({
      sh: 50,
      sw: 50,
      sx: 95,
      sy: 55,
    });
  });

  it("按设备像素比换算取样区域", () => {
    expect(getMagnifierSample({ x: 120, y: 80 }, 200, 2, 2)).toEqual({
      sh: 200,
      sw: 200,
      sx: 140,
      sy: 60,
    });
  });

  it("倍率为 0 时兜底成 1 倍，不出现除零", () => {
    expect(getMagnifierSample({ x: 120, y: 80 }, 200, 0, 1)).toEqual({
      sh: 200,
      sw: 200,
      sx: 20,
      sy: -20,
    });
  });

  it("设备像素比非法时兜底成 1", () => {
    expect(getMagnifierSample({ x: 120, y: 80 }, 200, 2, 0)).toEqual(
      getMagnifierSample({ x: 120, y: 80 }, 200, 2, 1),
    );
  });

  it("指针在画布外时取样越界不夹紧，交给 drawImage 裁切", () => {
    expect(getMagnifierSample({ x: 10, y: 10 }, 200, 2, 1)).toEqual({
      sh: 100,
      sw: 100,
      sx: -40,
      sy: -40,
    });
  });
});

describe("drawMagnifierLens", () => {
  it("先铺白底再把取样区域放大铺满镜片", () => {
    const context = createContext();
    const lens = {
      height: 0,
      width: 0,
      getContext: () => context,
    } as unknown as MagnifierLensCanvas;
    const source = { height: 540, width: 960 } as unknown as CanvasImageSource;

    drawMagnifierLens(lens, source, 200, { sh: 100, sw: 100, sx: 70, sy: 30 }, 1);

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 200, 200);
    expect(context.drawImage).toHaveBeenCalledWith(source, 70, 30, 100, 100, 0, 0, 200, 200);
  });

  it("按设备像素比放大镜片画布", () => {
    const context = createContext();
    const lens = {
      height: 0,
      width: 0,
      getContext: () => context,
    } as unknown as MagnifierLensCanvas;

    drawMagnifierLens(
      lens,
      {} as unknown as CanvasImageSource,
      200,
      { sh: 100, sw: 100, sx: 0, sy: 0 },
      2,
    );

    expect(lens.width).toBe(400);
    expect(lens.height).toBe(400);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 400, 400);
  });

  it("镜片尺寸没变时不重设画布宽高，避免清空已绘制内容", () => {
    const context = createContext();
    const state = { height: 200, width: 200 };
    const setCount = { height: 0, width: 0 };
    const lens = {
      get height() {
        return state.height;
      },
      get width() {
        return state.width;
      },
      set height(value: number) {
        setCount.height += 1;
        state.height = value;
      },
      set width(value: number) {
        setCount.width += 1;
        state.width = value;
      },
      getContext: () => context,
    } as unknown as MagnifierLensCanvas;

    drawMagnifierLens(
      lens,
      {} as unknown as CanvasImageSource,
      200,
      { sh: 0, sw: 0, sx: 0, sy: 0 },
      1,
    );

    expect(setCount).toEqual({ height: 0, width: 0 });
  });

  it("镜片尺寸变化时重设一次画布宽高", () => {
    const state = { height: 0, width: 0 };
    const setCount = { height: 0, width: 0 };
    const lens = {
      get height() {
        return state.height;
      },
      get width() {
        return state.width;
      },
      set height(value: number) {
        setCount.height += 1;
        state.height = value;
      },
      set width(value: number) {
        setCount.width += 1;
        state.width = value;
      },
      getContext: () => null,
    } as unknown as MagnifierLensCanvas;

    drawMagnifierLens(
      lens,
      {} as unknown as CanvasImageSource,
      120,
      { sh: 0, sw: 0, sx: 0, sy: 0 },
      1,
    );

    expect(setCount).toEqual({ height: 1, width: 1 });
    expect(state).toEqual({ height: 120, width: 120 });
  });

  it("拿不到 2d 上下文时直接返回，不抛错", () => {
    const lens = { height: 0, width: 0, getContext: () => null } as unknown as MagnifierLensCanvas;

    expect(() =>
      drawMagnifierLens(
        lens,
        {} as unknown as CanvasImageSource,
        200,
        { sh: 1, sw: 1, sx: 0, sy: 0 },
        1,
      ),
    ).not.toThrow();
  });
});
