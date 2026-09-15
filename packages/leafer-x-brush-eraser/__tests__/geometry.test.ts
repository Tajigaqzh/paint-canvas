import { describe, expect, it } from "vitest";
import { getPointDistance, normalizeLinePoints, padSinglePoint } from "../src";

describe("getPointDistance", () => {
  it("按两点欧氏距离计算", () => {
    expect(getPointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("同一点距离为 0", () => {
    expect(getPointDistance({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
  });
});

describe("normalizeLinePoints", () => {
  it("没有点对时返回 undefined", () => {
    expect(normalizeLinePoints([])).toBeUndefined();
  });

  it("只有一个坐标时返回 undefined", () => {
    expect(normalizeLinePoints([10])).toBeUndefined();
  });

  it("归一化成外接矩形加相对左上角的局部点", () => {
    expect(normalizeLinePoints([10, 20, 40, 50])).toEqual({
      height: 30,
      points: [0, 0, 30, 30],
      width: 30,
      x: 10,
      y: 20,
    });
  });

  it("多段折线同样按外接矩形归一化", () => {
    expect(normalizeLinePoints([10, 20, 40, 10, 10, 50])).toEqual({
      height: 40,
      points: [0, 10, 30, 0, 0, 40],
      width: 30,
      x: 10,
      y: 10,
    });
  });

  it("只有一个采样点时补成极短线段", () => {
    const result = normalizeLinePoints([10, 20]);

    expect(result?.points).toHaveLength(4);
    expect(result?.x).toBe(10);
    expect(result?.y).toBe(20);
  });

  it("单点笔迹的包围盒至少有 1 的宽高", () => {
    const result = normalizeLinePoints([10, 20]);

    expect(result?.width).toBe(1);
    expect(result?.height).toBe(1);
  });

  it("不修改传入的采样点数组", () => {
    const points = [10, 20];

    normalizeLinePoints(points);

    expect(points).toEqual([10, 20]);
  });
});

describe("padSinglePoint", () => {
  it("只有一个点时补成极短线段", () => {
    expect(padSinglePoint([1, 2])).toEqual([1, 2, 1.1, 2.1]);
  });

  it("已经是线段时原样返回", () => {
    const points = [1, 2, 3, 4];

    expect(padSinglePoint(points)).toBe(points);
  });
});
