import { describe, expect, it } from "vitest";
import { applyTextStyleRange, splitGraphemes } from "../textStyle";

describe("splitGraphemes", () => {
  it("keeps a composed emoji as one character index", () => {
    expect(splitGraphemes("A👨‍👩‍👧‍👦B")).toEqual(["A", "👨‍👩‍👧‍👦", "B"]);
  });

  it("returns an empty list for empty text", () => {
    expect(splitGraphemes("")).toEqual([]);
  });
});

describe("applyTextStyleRange", () => {
  it("applies a property to the selected graphemes and preserves other styles", () => {
    expect(
      applyTextStyleRange(
        "abcd",
        [{ start: 0, end: 1, fontWeight: 700 }],
        { start: 1, end: 3 },
        { fill: "#00ff00" },
      ),
    ).toEqual([
      { start: 0, end: 1, fontWeight: 700 },
      { start: 1, end: 3, fill: "#00ff00" },
    ]);
  });

  it("returns no ranges for an empty selection", () => {
    expect(applyTextStyleRange("abc", [], { start: 1, end: 1 }, { fontSize: 32 })).toEqual([]);
  });

  it("applies font weight only to the selected graphemes", () => {
    expect(applyTextStyleRange("abc", [], { start: 1, end: 2 }, { fontWeight: 700 })).toEqual([
      { start: 1, end: 2, fontWeight: 700 },
    ]);
  });
});
