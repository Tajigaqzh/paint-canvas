import { describe, expect, it } from "vitest";
import type { CanvasPage, LineNode } from "@/types";
import {
  findHitNode,
  getLineLocalPoint,
  getPointDistance,
  getPointToSegmentDistance,
  getPreviewLocalPoint,
  isPointNearLineNode,
} from "../hitDetection";

const line = (overrides: Partial<LineNode> = {}): LineNode => ({
  animationList: [],
  fill: "transparent",
  height: 0,
  id: "line-1",
  kind: "line",
  name: "线",
  rotation: 0,
  stroke: "#111",
  strokeWidth: 4,
  transformOrigin: "top-left",
  width: 100,
  x: 0,
  y: 0,
  ...overrides,
});

describe("getPointDistance", () => {
  it("同一点距离为 0", () => {
    expect(getPointDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it("水平两点距离为差值绝对值", () => {
    expect(getPointDistance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });
});

describe("getPointToSegmentDistance", () => {
  it("点在线段上时为 0", () => {
    expect(getPointToSegmentDistance({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  it("线段退化为点时按点距离", () => {
    expect(getPointToSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });

  it("投影落在线段外时取端点距离", () => {
    expect(getPointToSegmentDistance({ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });
});

describe("isPointNearLineNode", () => {
  it("默认横线在容差内命中", () => {
    expect(isPointNearLineNode(line(), { x: 50, y: 0 }, 2, { x: 0, y: 0 })).toBe(true);
  });

  it("远离路径时不命中", () => {
    expect(isPointNearLineNode(line(), { x: 50, y: 80 }, 2, { x: 0, y: 0 })).toBe(false);
  });

  it("自定义 points 按折线检测", () => {
    const node = line({ points: [0, 0, 0, 40] });
    expect(isPointNearLineNode(node, { x: 0, y: 20 }, 2, { x: 0, y: 0 })).toBe(true);
  });
});

describe("findHitNode", () => {
  it("空页面返回 undefined", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: {},
      rootIds: [],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(findHitNode(page, [], { x: 0, y: 0 }, 4)).toBeUndefined();
  });

  it("跳过不存在的 id", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: {},
      rootIds: ["missing"],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(findHitNode(page, ["missing"], { x: 0, y: 0 }, 4)).toBeUndefined();
  });

  it("矩形不参与橡皮擦命中", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: {
        r: {
          animationList: [],
          fill: "#fff",
          height: 100,
          id: "r",
          kind: "rect",
          name: "矩形",
          rotation: 0,
          transformOrigin: "center",
          width: 100,
          x: 0,
          y: 0,
        },
      },
      rootIds: ["r"],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(findHitNode(page, ["r"], { x: 10, y: 10 }, 20)).toBeUndefined();
  });

  it("命中最上层 line", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: { "line-1": line() },
      rootIds: ["line-1"],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(findHitNode(page, ["line-1"], { x: 10, y: 0 }, 4)?.id).toBe("line-1");
  });
});

describe("getLineLocalPoint", () => {
  it("扣掉节点坐标和父级偏移", () => {
    expect(getLineLocalPoint(line({ x: 10, y: 20 }), { x: 15, y: 24 }, { x: 1, y: 2 })).toEqual({
      x: 4,
      y: 2,
    });
  });
});

describe("getPreviewLocalPoint", () => {
  it("用 preview 缓存的坐标换算", () => {
    expect(
      getPreviewLocalPoint(
        {
          nodeX: 10,
          nodeY: 20,
          parentOffset: { x: 1, y: 2 },
          path: [],
          tempLine: {} as never,
        },
        { x: 15, y: 24 },
      ),
    ).toEqual({ x: 4, y: 2 });
  });
});
