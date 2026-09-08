import { afterEach, describe, expect, it } from "vitest";
import {
  getDraggingMaterialKind,
  isCanvasMaterialKind,
  mapMaterialDropPoint,
  setDraggingMaterialKind,
} from "../materialDrop";

const viewport = { height: 1080, width: 1920 };

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
  it("无偏移且 scale=1 时 client 减 rect 即为画板坐标", () => {
    expect(
      mapMaterialDropPoint(
        10,
        20,
        createView({ left: 10, top: 20 }),
        { height: 1080, width: 1920 },
        viewport,
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("画板中心 client 映射到 960,540", () => {
    expect(
      mapMaterialDropPoint(
        960,
        540,
        createView({ left: 0, top: 0 }),
        { height: 1080, width: 1920 },
        viewport,
      ),
    ).toEqual({ x: 960, y: 540 });
  });

  it("落在白板外返回 undefined", () => {
    expect(
      mapMaterialDropPoint(
        -8,
        0,
        createView({ left: 0, top: 0 }),
        { height: 1080, width: 1920 },
        viewport,
      ),
    ).toBeUndefined();
  });

  it("clientX 为 NaN 时返回 undefined", () => {
    expect(
      mapMaterialDropPoint(
        Number.NaN,
        0,
        createView({ left: 0, top: 0 }),
        { height: 1080, width: 1920 },
        viewport,
      ),
    ).toBeUndefined();
  });
});
