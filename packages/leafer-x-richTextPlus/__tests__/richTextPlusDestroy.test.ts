// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type RichTextPlusCtor = typeof import("../src/richTextPlus").RichTextPlus;
type RichTextPlusInstance = InstanceType<RichTextPlusCtor>;

/**
 * jsdom 没有 2D 上下文，leafer-ui 在 import 阶段就会创建测量画布并调用 setTransform 等方法，
 * 所以这里用一个 Proxy 兜住：已知属性（font / measureText）给真实值，其余一律 no-op。
 */
const createFakeContext = () => {
  const known: Record<string, unknown> = {
    font: "10px sans-serif",
    measureText: (text: string) => ({ width: text.length * 10 }),
  };
  return new Proxy(known, {
    get: (target, prop) =>
      prop in target ? target[prop as string] : (() => undefined as unknown as never),
    set: (target, prop, value) => {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

/** leafer-ui 在模块顶层就会取这些浏览器全局类，jsdom 只给了 HTMLCanvasElement，缺一个会在 import 阶段抛错 */
const stubMissingBrowserGlobals = () => {
  for (const name of ["CanvasRenderingContext2D", "Path2D", "DragEvent"]) {
    (globalThis as any)[name] ??= class {};
  }
};

/** 测量画布是私有字段，测试里按实例读取 */
const getMeasureCanvas = (node: RichTextPlusInstance) =>
  (node as unknown as { _measureCanvas: HTMLCanvasElement })._measureCanvas;

let RichTextPlus: RichTextPlusCtor;

describe("RichTextPlus.destroy", () => {
  beforeAll(async () => {
    stubMissingBrowserGlobals();
    // 必须在 import 之前就装好，leafer 的 web 平台在模块初始化时就会建画布
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createFakeContext() as any,
    );
    ({ RichTextPlus } = await import("../src/richTextPlus"));
  });

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createFakeContext() as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("销毁前测量画布持有默认尺寸的位图", () => {
    const node = new RichTextPlus();
    const canvas = getMeasureCanvas(node);

    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it("销毁后把测量画布宽高清零以释放 backing store", () => {
    const node = new RichTextPlus();
    const canvas = getMeasureCanvas(node);

    node.destroy();

    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});
