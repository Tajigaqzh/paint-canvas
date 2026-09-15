import { afterEach, describe, expect, it } from "vitest";
import { BOARD_INSET } from "../hooks/leaferCanvas/geometry/boardLayout";
import {
  getDraggingMaterialKind,
  isCanvasMaterialKind,
  mapMaterialDropPoint,
  setDraggingMaterialKind,
} from "../materialDrop";

const viewport = { height: 1080, width: 1920 };
/** 视图 = 画板尺寸 + 左上角标尺刻度条，此时 scale = 1，白板偏移正好是 BOARD_INSET。 */
const viewSize = { height: viewport.height + BOARD_INSET, width: viewport.width + BOARD_INSET };

const createView = (rect: Pick<DOMRect, "left" | "top">) =>
  ({
    getBoundingClientRect: () => rect as DOMRect,
  }) as HTMLElement;

describe("isCanvasMaterialKind", () => {
  it("空字符串不是素材类型", () => {
    expect(isCanvasMaterialKind("")).toBe(false);
  });

  it("rect 是素材类型", () => {
    expect(isCanvasMaterialKind("rect")).toBe(true);
  });

  it("image 是素材类型", () => {
    expect(isCanvasMaterialKind("image")).toBe(true);
  });

  it("upload 不是素材类型", () => {
    expect(isCanvasMaterialKind("upload")).toBe(false);
  });

  it("group 不是素材类型", () => {
    expect(isCanvasMaterialKind("group")).toBe(false);
  });
});

describe("getDraggingMaterialKind / setDraggingMaterialKind", () => {
  afterEach(() => {
    setDraggingMaterialKind(undefined);
  });

  it("未设置时返回 undefined", () => {
    expect(getDraggingMaterialKind()).toBeUndefined();
  });

  it("设置 rect 后能读到", () => {
    setDraggingMaterialKind("rect");
    expect(getDraggingMaterialKind()).toBe("rect");
  });

  it("再设为 undefined 后清空", () => {
    setDraggingMaterialKind("image");
    setDraggingMaterialKind(undefined);
    expect(getDraggingMaterialKind()).toBeUndefined();
  });
});

describe("mapMaterialDropPoint", () => {
  it("白板左上角 client 映射到画板 0,0", () => {
    expect(
      mapMaterialDropPoint(
        10 + BOARD_INSET,
        20 + BOARD_INSET,
        createView({ left: 10, top: 20 }),
        viewSize,
        viewport,
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("画板中心 client 映射到 960,540", () => {
    expect(
      mapMaterialDropPoint(
        960 + BOARD_INSET,
        540 + BOARD_INSET,
        createView({ left: 0, top: 0 }),
        viewSize,
        viewport,
      ),
    ).toEqual({ x: 960, y: 540 });
  });

  it("落在标尺刻度条占用的区域时不算命中白板", () => {
    expect(
      mapMaterialDropPoint(
        BOARD_INSET - 1,
        BOARD_INSET - 1,
        createView({ left: 0, top: 0 }),
        viewSize,
        viewport,
      ),
    ).toBeUndefined();
  });

  it("落在白板外返回 undefined", () => {
    expect(
      mapMaterialDropPoint(-8, 0, createView({ left: 0, top: 0 }), viewSize, viewport),
    ).toBeUndefined();
  });

  it("clientX 为 NaN 时返回 undefined", () => {
    expect(
      mapMaterialDropPoint(Number.NaN, 0, createView({ left: 0, top: 0 }), viewSize, viewport),
    ).toBeUndefined();
  });
});
