import { describe, expect, it } from "vitest";
import {
  BOARD_INSET,
  getBoardLayout,
  isPointInViewport,
  mapClientPointToBoard,
} from "../boardLayout";

const viewport = { height: 1080, width: 1920 };
/** 容器尺寸 = 业务画板尺寸 + 标尺刻度条占用空间。 */
const viewWithInset = {
  height: viewport.height + BOARD_INSET,
  width: viewport.width + BOARD_INSET,
};

describe("getBoardLayout", () => {
  it("容器正好放得下画板和标尺时 scale 为 1，白板让出左上角刻度条", () => {
    expect(getBoardLayout(viewWithInset.width, viewWithInset.height, viewport)).toEqual({
      boardX: BOARD_INSET,
      boardY: BOARD_INSET,
      scale: 1,
    });
  });

  it("更窄的容器按宽度缩放，并在刻度条右侧垂直居中", () => {
    const layout = getBoardLayout(960 + BOARD_INSET, viewWithInset.height, viewport);

    expect(layout.scale).toBe(0.5);
    expect(layout.boardX).toBe(BOARD_INSET);
    expect(layout.boardY).toBe(BOARD_INSET + (1080 - 1080 * 0.5) / 2);
  });

  it("容器比刻度条还小时不会出现负的可用空间", () => {
    expect(getBoardLayout(10, 10, viewport)).toEqual({
      boardX: BOARD_INSET,
      boardY: BOARD_INSET,
      scale: 0,
    });
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
