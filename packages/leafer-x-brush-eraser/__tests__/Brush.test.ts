import { describe, expect, it, vi } from "vitest";
import { Brush } from "../src";
import type { BrushDrawEvent } from "../src";
import { createContainer, dispatchPointer, toRect } from "./helpers";

vi.mock("@leafer-ui/core", () => ({
  Creator: { selector: vi.fn() },
  Line: class MockLine {
    data: Record<string, unknown>;
    destroyed = false;

    constructor(data: Record<string, unknown>) {
      this.data = { ...data };
    }

    set(data: Record<string, unknown>) {
      Object.assign(this.data, data);
    }

    destroy() {
      this.destroyed = true;
    }
  },
}));

type MockLine = { data: Record<string, unknown>; destroyed: boolean };

const createBrush = (options: { canvasRect?: DOMRect; strokeWidth?: number } = {}) => {
  const env = createContainer(options.canvasRect);
  const brush = new Brush({
    container: env.container,
    strokeWidth: options.strokeWidth ?? 4,
  });
  const draws: BrushDrawEvent[] = [];

  brush.on("draw", (event) => draws.push(event));

  return { ...env, brush, draws };
};

describe("Brush", () => {
  it("按下-移动-抬手抛出一条归一化笔迹", () => {
    const { draws, view } = createBrush();

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointermove", { clientX: 140, clientY: 160 });
    dispatchPointer(window, "pointerup", { clientX: 140, clientY: 160 });

    expect(draws).toEqual([
      {
        height: 60,
        points: [0, 0, 40, 60],
        stroke: "#111827",
        strokeWidth: 4,
        width: 40,
        x: 100,
        y: 100,
      },
    ]);
  });

  it("拖动过程中预览 Line 在容器里，抬手后销毁", () => {
    const { children, view } = createBrush();

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 100 });

    const preview = children[0] as MockLine;

    expect(preview.data).toMatchObject({
      className: "brush-preview",
      points: [100, 100, 120, 100],
      strokeWidth: 4,
    });

    dispatchPointer(window, "pointerup", { clientX: 120, clientY: 100 });

    expect(preview.destroyed).toBe(true);
  });

  it("只按下不移动时产生一个点状笔迹", () => {
    const { draws, view } = createBrush();

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointerup", { clientX: 100, clientY: 100 });

    expect(draws[0].points).toHaveLength(4);
    expect(draws[0].width).toBe(1);
    expect(draws[0].height).toBe(1);
  });

  it("位移小于采样距离的移动点会被丢掉", () => {
    const { draws, view } = createBrush();

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointermove", { clientX: 100.5, clientY: 100.5 });
    dispatchPointer(window, "pointerup", { clientX: 100.5, clientY: 100.5 });

    expect(draws[0].points).toHaveLength(4);
  });

  it("自定义描边颜色会带进事件", () => {
    const { container, view } = createContainer();
    const brush = new Brush({ container, stroke: "#ff0000", strokeWidth: 12 });
    const draws: BrushDrawEvent[] = [];

    brush.on("draw", (event) => draws.push(event));
    dispatchPointer(view, "pointerdown", { clientX: 0, clientY: 0 });
    dispatchPointer(window, "pointerup", { clientX: 0, clientY: 0 });

    expect(draws[0]).toMatchObject({ stroke: "#ff0000", strokeWidth: 12 });
  });

  it("禁用后不响应指针", () => {
    const { brush, draws, view } = createBrush();

    brush.enabled = false;
    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointerup", { clientX: 100, clientY: 100 });

    expect(draws).toHaveLength(0);
  });

  it("中途禁用会丢掉预览且不抛事件", () => {
    const { brush, children, draws, view } = createBrush();

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    brush.enabled = false;

    expect((children[0] as MockLine).destroyed).toBe(true);

    dispatchPointer(window, "pointerup", { clientX: 100, clientY: 100 });

    expect(draws).toHaveLength(0);
  });

  it("画布还没有尺寸时不起手势", () => {
    const { draws, view } = createBrush({ canvasRect: toRect(0, 0, 0, 0) });

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointerup", { clientX: 100, clientY: 100 });

    expect(draws).toHaveLength(0);
  });

  it("dispose 后不再抛事件", () => {
    const { brush, draws, view } = createBrush();

    dispatchPointer(view, "pointerdown", { clientX: 100, clientY: 100 });
    brush.dispose();
    dispatchPointer(window, "pointerup", { clientX: 100, clientY: 100 });

    expect(draws).toHaveLength(0);
  });

  it("非主键按下不画线", () => {
    const { draws, view } = createBrush();

    dispatchPointer(view, "pointerdown", { button: 2, clientX: 100, clientY: 100 });
    dispatchPointer(window, "pointerup", { clientX: 100, clientY: 100 });

    expect(draws).toHaveLength(0);
  });
});
