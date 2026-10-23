import { describe, expect, it, vi } from "vitest";
import { splitGraphemes } from "../src";

describe("splitGraphemes", () => {
  it("空字符串返回空数组", () => {
    expect(splitGraphemes("")).toEqual([]);
  });

  it("ASCII 字符逐个切分", () => {
    expect(splitGraphemes("abc")).toEqual(["a", "b", "c"]);
  });

  it("保留组合附加符组成的字符", () => {
    expect(splitGraphemes("e\u0301")).toEqual(["e\u0301"]);
  });

  it("保留 emoji 肤色修饰符", () => {
    expect(splitGraphemes("👍🏽")).toEqual(["👍🏽"]);
  });

  it("保留 ZWJ 家庭 emoji 序列", () => {
    expect(splitGraphemes("👨‍👩‍👧‍👦")).toEqual(["👨‍👩‍👧‍👦"]);
  });

  it("保留 ZWJ 职业 emoji 序列", () => {
    expect(splitGraphemes("👩🏽‍🚀")).toEqual(["👩🏽‍🚀"]);
  });

  it("保留区域指示符组成的国旗", () => {
    expect(splitGraphemes("🇨🇳🇺🇸")).toEqual(["🇨🇳", "🇺🇸"]);
  });

  it("保留键帽 emoji 和变体选择符", () => {
    expect(splitGraphemes("1️⃣✈️")).toEqual(["1️⃣", "✈️"]);
  });

  it("中文、标点和空格分别作为字素簇", () => {
    expect(splitGraphemes("你好， world！")).toEqual([
      "你",
      "好",
      "，",
      " ",
      "w",
      "o",
      "r",
      "l",
      "d",
      "！",
    ]);
  });

  it("Intl.Segmenter 不可用时回退分割仍保留组合 emoji", () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });

    expect(splitGraphemes("👍🏽👨‍👩‍👧‍👦🇨🇳1️⃣e\u0301")).toEqual(["👍🏽", "👨‍👩‍👧‍👦", "🇨🇳", "1️⃣", "e\u0301"]);

    vi.unstubAllGlobals();
  });
});
