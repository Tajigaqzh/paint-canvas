import { describe, expect, it } from "vitest";
import { getVideoDrawRect } from "../src";

describe("getVideoDrawRect", () => {
  it("contain 模式：取较小缩放，视频完整居中并上下留黑边", () => {
    // 200x100 放进 100x100，宽度方向更紧：scale = min(100/200, 100/100) = 0.5
    expect(getVideoDrawRect(200, 100, 100, 100, "contain")).toEqual({
      dx: 0,
      dy: 25,
      width: 100,
      height: 50,
    });
  });

  it("contain 模式：竖向视频放在正方形里左右留黑边", () => {
    // 100x200 放进 100x100，高度方向更紧：scale = min(1, 0.5) = 0.5
    expect(getVideoDrawRect(100, 200, 100, 100, "contain")).toEqual({
      dx: 25,
      dy: 0,
      width: 50,
      height: 100,
    });
  });

  it("contain 模式：宽高比相同则铺满不留边", () => {
    expect(getVideoDrawRect(100, 100, 100, 100, "contain")).toEqual({
      dx: 0,
      dy: 0,
      width: 100,
      height: 100,
    });
  });

  it("cover 模式：取较大缩放，视频铺满并被左右裁切", () => {
    // 200x100 放进 100x100，高度方向更松：scale = max(0.5, 1) = 1
    expect(getVideoDrawRect(200, 100, 100, 100, "cover")).toEqual({
      dx: -50,
      dy: 0,
      width: 200,
      height: 100,
    });
  });

  it("cover 模式：竖向视频放在正方形里上下裁切", () => {
    // 100x200 放进 100x100，高度方向更松：scale = max(1, 0.5) = 1
    expect(getVideoDrawRect(100, 200, 100, 100, "cover")).toEqual({
      dx: 0,
      dy: -50,
      width: 100,
      height: 200,
    });
  });

  it("cover 模式：宽高比相同则铺满", () => {
    expect(getVideoDrawRect(100, 100, 100, 100, "cover")).toEqual({
      dx: 0,
      dy: 0,
      width: 100,
      height: 100,
    });
  });

  it("源宽度为 0 时兜底成整块目标矩形，不除零", () => {
    expect(getVideoDrawRect(0, 100, 400, 300, "contain")).toEqual({
      dx: 0,
      dy: 0,
      width: 400,
      height: 300,
    });
  });

  it("源高度为负时兜底成整块目标矩形", () => {
    expect(getVideoDrawRect(100, -10, 400, 300, "cover")).toEqual({
      dx: 0,
      dy: 0,
      width: 400,
      height: 300,
    });
  });

  it("目标宽度为 0 时返回零宽矩形", () => {
    expect(getVideoDrawRect(100, 100, 0, 300, "contain")).toEqual({
      dx: 0,
      dy: 0,
      width: 0,
      height: 300,
    });
  });

  it("目标高度与源尺寸全为 0 时返回全零矩形", () => {
    expect(getVideoDrawRect(0, 0, 0, 0, "cover")).toEqual({
      dx: 0,
      dy: 0,
      width: 0,
      height: 0,
    });
  });
});
