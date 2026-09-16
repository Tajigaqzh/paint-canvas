import { describe, expect, it, vi } from "vitest";
import type { ISelector } from "@leafer-ui/interface";
import { Eraser } from "../src";
import type { EraserEraseEvent } from "../src";
import { createContainer, createEraseContainer, createTarget, dispatchPointer } from "./helpers";

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

/** 造一个「按点命中固定目标」的选择器，并把它挂到容器的 leafer 上。 */
const createEraser = (
  options: { erasable?: (target: unknown) => boolean; target?: unknown } = {},
) => {
  const env = createContainer();
  const eraseContainer = createEraseContainer();
  const target = options.target ?? createTarget(eraseContainer);
  const getByPoint = vi.fn(() => ({ target }));

  (env.container.leafer as { selector?: ISelector }).selector = {
    getByPoint,
  } as unknown as ISelector;

  const eraser = new Eraser({
    container: env.container,
    erasable: options.erasable,
    strokeWidth: 20,
  });
  const erases: EraserEraseEvent[] = [];

  eraser.on("erase", (event) => erases.push(event));

  return { ...env, eraseContainer, eraser, erases, getByPoint, target };
};

describe("Eraser", () => {
  it("命中后在目标父容器插入 eraser 预览，抬手抛出一条轨迹", () => {
    const { erases, eraseContainer, target, view } = createEraser();

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointermove", { clientX: 60, clientY: 40 });

    const preview = eraseContainer.children[0] as MockLine;

    expect(preview.data).toMatchObject({
      eraser: "pixel",
      points: [30, 40, 60, 40],
      strokeWidth: 20,
    });

    dispatchPointer(window, "pointerup", { clientX: 60, clientY: 40 });

    expect(erases).toEqual([
      {
        container: eraseContainer,
        offset: { x: 10, y: 20 },
        points: [30, 40, 60, 40],
        strokeWidth: 20,
        target,
      },
    ]);
    expect(preview.destroyed).toBe(true);
  });

  it("一次手势结束时抛一次 end，带上全部轨迹", () => {
    const { erases, eraser, view } = createEraser();
    const ends: EraserEraseEvent[][] = [];

    eraser.on("end", ({ strokes }) => ends.push(strokes));

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointermove", { clientX: 60, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 60, clientY: 40 });

    expect(ends).toHaveLength(1);
    expect(ends[0]).toHaveLength(1);
    expect(ends[0][0].points).toEqual([30, 40, 60, 40]);
    expect(erases).toHaveLength(1);
  });

  it("一次都没擦到时同样抛 end，但轨迹为空", () => {
    const { eraser, view } = createEraser({ erasable: () => false });
    const ends: EraserEraseEvent[][] = [];

    eraser.on("end", ({ strokes }) => ends.push(strokes));

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(ends).toEqual([[]]);
  });

  it("命中半径取擦除宽度的一半", () => {
    const { eraser, getByPoint, view } = createEraser();

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(getByPoint).toHaveBeenCalledWith({ x: 30, y: 40 }, 10, { through: true });

    eraser.dispose();
  });

  it("没命中时不插入预览也不抛事件", () => {
    const env = createContainer();
    const getByPoint = vi.fn(() => ({ target: undefined }));

    (env.container.leafer as { selector?: ISelector }).selector = {
      getByPoint,
    } as unknown as ISelector;

    const eraser = new Eraser({ container: env.container });
    const erases: EraserEraseEvent[] = [];

    eraser.on("erase", (event) => erases.push(event));

    dispatchPointer(env.view, "pointerdown", { clientX: 10, clientY: 10 });
    dispatchPointer(window, "pointermove", { clientX: 40, clientY: 10 });
    dispatchPointer(window, "pointerup", { clientX: 40, clientY: 10 });

    expect(erases).toHaveLength(0);
    expect(env.children).toHaveLength(0);
  });

  it("erasable 过滤掉的目标不参与擦除", () => {
    const { erases, view } = createEraser({ erasable: () => false });

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(erases).toHaveLength(0);
  });

  it("同一次手势里擦到两个目标会各抛一条轨迹", () => {
    const env = createContainer();
    const first = createTarget(createEraseContainer());
    const second = createTarget(createEraseContainer());
    const getByPoint = vi
      .fn()
      .mockReturnValueOnce({ target: first })
      .mockReturnValueOnce({ target: undefined })
      .mockReturnValueOnce({ target: second });

    (env.container.leafer as { selector?: ISelector }).selector = {
      getByPoint,
    } as unknown as ISelector;

    const eraser = new Eraser({ container: env.container });
    const erases: EraserEraseEvent[] = [];

    eraser.on("erase", (event) => erases.push(event));

    dispatchPointer(env.view, "pointerdown", { clientX: 10, clientY: 10 });
    dispatchPointer(window, "pointermove", { clientX: 20, clientY: 10 });
    dispatchPointer(window, "pointermove", { clientX: 30, clientY: 10 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 10 });

    expect(erases.map((event) => event.target)).toEqual([first, second]);
  });

  it("同一点命中多层笔迹时，每层各插预览并各抛一条擦除轨迹", () => {
    const env = createContainer();
    const topGroup = createEraseContainer();
    const bottomGroup = createEraseContainer();
    const topLeaf = createTarget(topGroup);
    const bottomLeaf = createTarget(bottomGroup);
    // 选择器带 through 时返回命中的全部图层（上层在前）。
    const getByPoint = vi.fn(() => ({ throughPath: { list: [topLeaf, bottomLeaf] } }));

    (env.container.leafer as { selector?: ISelector }).selector = {
      getByPoint,
    } as unknown as ISelector;

    const eraser = new Eraser({ container: env.container, strokeWidth: 20 });
    const erases: EraserEraseEvent[] = [];

    eraser.on("erase", (event) => erases.push(event));

    dispatchPointer(env.view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointermove", { clientX: 60, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 60, clientY: 40 });

    // 两层都擦到：各自一个容器、一条轨迹，且按 group 去重不会重复。
    expect(erases).toHaveLength(2);
    expect(erases.map((event) => event.container)).toEqual([topGroup, bottomGroup]);
    erases.forEach((event) => {
      expect(event.points).toEqual([30, 40, 60, 40]);
      expect(event.strokeWidth).toBe(20);
    });
    // 每个 group 内部都插入了 eraser 预览。
    expect((topGroup.children[0] as MockLine).data).toMatchObject({ eraser: "pixel" });
    expect((bottomGroup.children[0] as MockLine).data).toMatchObject({ eraser: "pixel" });
  });

  it("同一条笔迹的多个命中叶子按 group 去重，只抛一条轨迹", () => {
    const env = createContainer();
    const group = createEraseContainer();
    const innerLeaf = createTarget(group);
    const eraserLeaf = createTarget(group);
    const getByPoint = vi.fn(() => ({ throughPath: { list: [innerLeaf, eraserLeaf] } }));

    (env.container.leafer as { selector?: ISelector }).selector = {
      getByPoint,
    } as unknown as ISelector;

    const eraser = new Eraser({ container: env.container, strokeWidth: 20 });
    const erases: EraserEraseEvent[] = [];

    eraser.on("erase", (event) => erases.push(event));

    dispatchPointer(env.view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(erases).toHaveLength(1);
    expect(erases[0].container).toBe(group);
  });

  it("preview 关闭时不插入预览但仍抛事件", () => {
    const env = createContainer();
    const eraseContainer = createEraseContainer();
    const target = createTarget(eraseContainer);
    const getByPoint = vi.fn(() => ({ target }));

    (env.container.leafer as { selector?: ISelector }).selector = {
      getByPoint,
    } as unknown as ISelector;

    const eraser = new Eraser({ container: env.container, preview: false });
    const erases: EraserEraseEvent[] = [];

    eraser.on("erase", (event) => erases.push(event));

    dispatchPointer(env.view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(eraseContainer.children).toHaveLength(0);
    expect(erases).toHaveLength(1);
  });

  it("禁用后不响应指针", () => {
    const { eraser, erases, view } = createEraser();

    eraser.enabled = false;
    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(erases).toHaveLength(0);
  });

  it("中途禁用会清掉预览且不抛事件", () => {
    const { eraser, erases, eraseContainer, view } = createEraser();

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    eraser.enabled = false;

    expect((eraseContainer.children[0] as MockLine).destroyed).toBe(true);

    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(erases).toHaveLength(0);
  });

  it("dispose 后不再抛事件", () => {
    const { eraser, erases, view } = createEraser();

    dispatchPointer(view, "pointerdown", { clientX: 30, clientY: 40 });
    eraser.dispose();
    dispatchPointer(window, "pointerup", { clientX: 30, clientY: 40 });

    expect(erases).toHaveLength(0);
  });
});
