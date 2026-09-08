import { describe, expect, it } from "vitest";
import type { CanvasNode } from "@/types";
import { getNodePaintInput, getStrokeDashPattern } from "../paint";

const rect = (overrides: Partial<Extract<CanvasNode, { kind: "rect" }>> = {}) =>
  ({
    animationList: [],
    fill: "#fff",
    height: 10,
    id: "r",
    kind: "rect" as const,
    name: "矩形",
    rotation: 0,
    transformOrigin: "center" as const,
    width: 10,
    x: 0,
    y: 0,
    ...overrides,
  }) satisfies Extract<CanvasNode, { kind: "rect" }>;

describe("getStrokeDashPattern", () => {
  it("没有描边宽度返回 undefined", () => {
    expect(getStrokeDashPattern(rect({ strokeWidth: 0 }))).toBeUndefined();
  });

  it("strokeWidth 缺省视为 0", () => {
    expect(getStrokeDashPattern(rect())).toBeUndefined();
  });

  it("dashed 随线宽放大", () => {
    expect(getStrokeDashPattern(rect({ strokeStyle: "dashed", strokeWidth: 2 }))).toEqual([8, 4]);
  });

  it("dotted 用短实线模拟圆点", () => {
    expect(getStrokeDashPattern(rect({ strokeStyle: "dotted", strokeWidth: 2 }))).toEqual([2, 4]);
  });

  it("solid 返回 undefined", () => {
    expect(getStrokeDashPattern(rect({ strokeStyle: "solid", strokeWidth: 2 }))).toBeUndefined();
  });
});

describe("getNodePaintInput", () => {
  it("矩形带上 fill", () => {
    expect(getNodePaintInput(rect({ fill: "#abc" })).fill).toBe("#abc");
  });

  it("图片节点不带 fill", () => {
    const image: Extract<CanvasNode, { kind: "image" }> = {
      animationList: [],
      height: 10,
      id: "i",
      kind: "image",
      name: "图",
      rotation: 0,
      src: "https://example.com/a.png",
      transformOrigin: "center",
      width: 10,
      x: 0,
      y: 0,
    };
    expect(getNodePaintInput(image)).not.toHaveProperty("fill");
  });
});
