import { describe, expect, it } from "vitest";
import { getBoardLayout, isPointInViewport, mapClientPointToBoard } from "../boardLayout";

const viewport = { height: 1080, width: 1920 };

describe("getBoardLayout", () => {
  it("容器正好是 1920x1080 时 scale 为 1 且无偏移", () => {
    expect(getBoardLayout(1920, 1080, viewport)).toEqual({ boardX: 0, boardY: 0, scale: 1 });
  });

  it("更窄的容器按宽度缩放并垂直居中", () => {
    const layout = getBoardLayout(960, 1080, viewport);
    expect(layout.scale).toBe(0.5);
    expect(layout.boardX).toBe(0);
    expect(layout.boardY).toBe(Math.max((1080 - 1080 * 0.5) / 2, 0));
  });
});

describe("isPointInViewport", () => {
  it("原点在画板内", () => {
    expect(isPointInViewport({ x: 0, y: 0 }, viewport)).toBe(true);
  });

  it("右下角在画板内", () => {
    expect(isPointInViewport({ x: 1920, y: 1080 }, viewport)).toBe(true);
  });

  it("负坐标在画板外", () => {
    expect(isPointInViewport({ x: -1, y: 0 }, viewport)).toBe(false);
  });
});

describe("mapClientPointToBoard", () => {
  it("无偏移 scale=1 时 client 减 rect.left/top", () => {
    const rect = { left: 10, top: 20 } as DOMRect;
    const layout = { boardX: 0, boardY: 0, scale: 1 };
    expect(mapClientPointToBoard(10, 20, rect, layout, viewport)).toEqual({ x: 0, y: 0 });
  });

  it("落在白板外返回 undefined", () => {
    const rect = { left: 0, top: 0 } as DOMRect;
    const layout = { boardX: 0, boardY: 0, scale: 1 };
    expect(mapClientPointToBoard(-8, 0, rect, layout, viewport)).toBeUndefined();
  });
});
