import { describe, expect, it, vi } from "vitest";
import type { LineNode } from "@/types";
import {
  getLineClass,
  getLineClassPrefix,
  getLineContentInput,
  getLineEraserInput,
} from "../lineUi";

vi.mock("leafer-ui", () => ({
  Line: vi.fn(),
}));

const line = (overrides: Partial<LineNode> = {}): LineNode => ({
  animationList: [],
  fill: "transparent",
  height: 2,
  id: "l",
  kind: "line",
  name: "线",
  points: [0, 0, 10, 0],
  rotation: 0,
  stroke: "#111",
  strokeWidth: 4,
  transformOrigin: "top-left",
  width: 10,
  x: 5,
  y: 6,
  ...overrides,
});

describe("getLineContentInput", () => {
  it("内部 line 固定在 0,0", () => {
    const input = getLineContentInput(line());
    expect(input.x).toBe(0);
    expect(input.y).toBe(0);
    expect(input.rotation).toBe(0);
  });

  it("没有 points 时不传 points", () => {
    const input = getLineContentInput(line({ points: undefined }));
    expect(input.points).toBeUndefined();
  });
});

describe("getLineEraserInput", () => {
  it("两个点会补成极短线段", () => {
    const input = getLineEraserInput([1, 2], 8);
    expect(input.points).toEqual([1, 2, 1.1, 2.1]);
    expect(input.strokeWidth).toBe(8);
    expect(input.eraser).toBe("pixel");
  });

  it("多于两个点原样使用", () => {
    expect(getLineEraserInput([0, 0, 3, 4], 4).points).toEqual([0, 0, 3, 4]);
  });
});

describe("场景标识", () => {
  it("画笔笔迹用 brush 前缀", () => {
    expect(getLineClassPrefix(line({ source: "brush" }))).toBe("brush");
    expect(getLineClass(line({ source: "brush" }), "path")).toBe("brush-path");
  });

  it("素材线条用 line 前缀", () => {
    expect(getLineClassPrefix(line({ source: "material" }))).toBe("line");
    expect(getLineClass(line({ source: "material" }), "eraser")).toBe("line-eraser");
  });

  it("老文档没有 source 时按 line 处理", () => {
    expect(getLineClassPrefix(line())).toBe("line");
  });

  it("内容 Line 带上 path 标识", () => {
    expect(getLineContentInput(line({ source: "brush" }))).toMatchObject({
      className: "brush-path",
    });
  });

  it("擦除轨迹输入可以带自己的 className", () => {
    expect(getLineEraserInput([0, 0, 1, 1], 4, "brush-eraser")).toMatchObject({
      className: "brush-eraser",
    });
  });
});
