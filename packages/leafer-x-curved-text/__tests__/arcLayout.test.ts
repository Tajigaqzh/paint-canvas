import { describe, expect, it, vi } from "vitest";
import { layoutArcText, type GraphemeMeasurer } from "../src";

const measureByLength: GraphemeMeasurer = ({ grapheme }) => grapheme.length * 10;
const baseOptions = { bendAngle: 90, radius: 100 };

describe("layoutArcText", () => {
  it("空字符串不调用测量器并返回空布局", () => {
    const measure = vi.fn(measureByLength);

    expect(layoutArcText("", baseOptions, measure)).toMatchObject({
      glyphs: [],
      height: 0,
      width: 0,
    });
    expect(measure).not.toHaveBeenCalled();
  });

  it("单字位于圆弧中心角且宽高为零", () => {
    const result = layoutArcText("字", baseOptions, () => 20);

    expect(result.glyphs).toHaveLength(1);
    expect(result.glyphs[0]).toMatchObject({
      advance: 20,
      angle: 0,
      grapheme: "字",
      rotation: 0,
    });
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it("零弯曲角度按测量宽度直线排列", () => {
    const result = layoutArcText(
      "a b",
      { ...baseOptions, bendAngle: 0, letterSpacing: 2 },
      () => 10,
    );

    expect(result.glyphs.map(({ x, y, rotation }) => ({ x, y, rotation }))).toEqual([
      { x: 5, y: 0, rotation: 0 },
      { x: 17, y: 0, rotation: 0 },
      { x: 29, y: 0, rotation: 0 },
    ]);
    expect(result.width).toBe(34);
  });

  it("弯曲布局保留标点和空格并根据测量宽度确定字符位置", () => {
    const result = layoutArcText("你， 好", baseOptions, ({ grapheme }) =>
      grapheme === " " ? 5 : 10,
    );

    expect(result.glyphs.map(({ grapheme }) => grapheme)).toEqual(["你", "，", " ", "好"]);
    expect(result.glyphs.map(({ index }) => index)).toEqual([0, 1, 2, 3]);
    expect(result.glyphs[1].angle).toBeGreaterThan(result.glyphs[0].angle);
    expect(result.glyphs[2].advance).toBe(5);
    expect(result.height).toBeGreaterThan(0);
  });

  it("混合字号和自定义字体逐字传入测量接口", () => {
    const measure = vi.fn(({ style }: Parameters<GraphemeMeasurer>[0]) => Number(style.fontSize));
    const result = layoutArcText(
      "AB",
      {
        ...baseOptions,
        defaultStyle: { fontFamily: "Teacher Sans", fontSize: 12 },
        styleRuns: [{ start: 1, end: 2, style: { fontFamily: "Classroom Display", fontSize: 24 } }],
      },
      measure,
    );

    expect(measure.mock.calls.map(([request]) => request.style)).toEqual([
      { fontFamily: "Teacher Sans", fontSize: 12 },
      { fontFamily: "Classroom Display", fontSize: 24 },
    ]);
    expect(result.glyphs.map(({ advance }) => advance)).toEqual([12, 24]);
  });

  it("复杂 Unicode emoji 各自只占一个布局字素簇", () => {
    const text = "👍🏽👨‍👩‍👧‍👦🇨🇳1️⃣";
    const result = layoutArcText(text, baseOptions, () => 16);

    expect(result.glyphs.map(({ grapheme }) => grapheme)).toEqual(["👍🏽", "👨‍👩‍👧‍👦", "🇨🇳", "1️⃣"]);
    expect(result.glyphs.map(({ index }) => index)).toEqual([0, 1, 2, 3]);
  });

  it("逆时针方向反转字符的角度与弧线位置", () => {
    const clockwise = layoutArcText(
      "ab",
      { ...baseOptions, direction: "clockwise", startAngle: 0 },
      () => 10,
    );
    const counterclockwise = layoutArcText(
      "ab",
      { ...baseOptions, direction: "counterclockwise", startAngle: 0 },
      () => 10,
    );

    expect(counterclockwise.glyphs[0].angle).toBe(-clockwise.glyphs[0].angle);
    expect(counterclockwise.glyphs[0].y).toBe(-clockwise.glyphs[0].y);
    expect(counterclockwise.glyphs[0].rotation).toBeGreaterThan(90);
  });

  it("修改字距后按新的字符中心重新计算切线旋转", () => {
    const compact = layoutArcText("abcd", { ...baseOptions, letterSpacing: 0 }, () => 10);
    const spaced = layoutArcText("abcd", { ...baseOptions, letterSpacing: 20 }, () => 10);

    expect(spaced.glyphs[0].rotation).not.toBe(compact.glyphs[0].rotation);
    expect(spaced.glyphs[3].rotation).not.toBe(compact.glyphs[3].rotation);
  });

  it("修改半径后重新计算每个字素的切线方向", () => {
    const small = layoutArcText("abcd", { ...baseOptions, radius: 40 }, () => 10);
    const large = layoutArcText("abcd", { ...baseOptions, radius: 400 }, () => 10);

    expect(large.glyphs[0].rotation).not.toBe(small.glyphs[0].rotation);
    expect(large.glyphs[3].rotation).not.toBe(small.glyphs[3].rotation);
  });

  it.each([
    ["start", 0],
    ["end", 3],
  ] as const)("%s 对齐在半径变化时保持锚点固定", (align, anchorIndex) => {
    const small = layoutArcText("abcd", { ...baseOptions, align, radius: 40 }, () => 10);
    const large = layoutArcText("abcd", { ...baseOptions, align, radius: 400 }, () => 10);

    expect(small.glyphs[anchorIndex].x).toBeCloseTo(0);
    expect(small.glyphs[anchorIndex].y).toBeCloseTo(0);
    expect(large.glyphs[anchorIndex].x).toBeCloseTo(0);
    expect(large.glyphs[anchorIndex].y).toBeCloseTo(0);
  });

  it("非法测量宽度回退为零且不会产生非有限坐标", () => {
    const result = layoutArcText("ab", baseOptions, () => Number.NaN);

    expect(
      result.glyphs.every(
        ({ x, y, rotation }) =>
          Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(rotation),
      ),
    ).toBe(true);
  });
});
