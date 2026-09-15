import { describe, expect, it } from "vitest";
import { FALLBACK_VIEW_SIZE, getCanvasViewSize } from "../canvasFit";

/** jsdom 不做真实布局，这里直接给假元素写死内边距。 */
const createShell = (padding?: string) => {
  const shell = document.createElement("div");

  if (padding) shell.style.padding = padding;

  return shell;
};

const shellSize = { height: 405, width: 720 };

describe("getCanvasViewSize", () => {
  it("shell 还没量出尺寸时返回兜底视图尺寸", () => {
    expect(getCanvasViewSize(undefined, createShell("18px"))).toEqual(FALLBACK_VIEW_SIZE);
  });

  it("shell 元素还没挂载时返回兜底视图尺寸", () => {
    expect(getCanvasViewSize(shellSize, null)).toEqual(FALLBACK_VIEW_SIZE);
  });

  it("扣掉 shell 内边距后返回内容区尺寸", () => {
    expect(getCanvasViewSize(shellSize, createShell("18px"))).toEqual({ height: 369, width: 684 });
  });

  it("没有内边距时直接返回 padding box 尺寸", () => {
    expect(getCanvasViewSize(shellSize, createShell())).toEqual({ height: 405, width: 720 });
  });

  it("只设了单边内边距时按左右和上下分别相加", () => {
    expect(getCanvasViewSize({ height: 400, width: 800 }, createShell("10px 4px"))).toEqual({
      height: 380,
      width: 792,
    });
  });

  it("内边距比 shell 尺寸还大时返回兜底视图尺寸，不出现负尺寸", () => {
    expect(getCanvasViewSize({ height: 20, width: 20 }, createShell("18px"))).toEqual(
      FALLBACK_VIEW_SIZE,
    );
  });
});
