import { describe, expect, it } from "vitest";
import { isAdditiveSelect } from "../additiveSelect";

describe("isAdditiveSelect", () => {
  it("无修饰键为 false", () => {
    expect(isAdditiveSelect({})).toBe(false);
  });

  it("ctrlKey 为 true", () => {
    expect(isAdditiveSelect({ ctrlKey: true })).toBe(true);
  });

  it("metaKey 为 true", () => {
    expect(isAdditiveSelect({ metaKey: true })).toBe(true);
  });

  it("shiftKey 为 true", () => {
    expect(isAdditiveSelect({ shiftKey: true })).toBe(true);
  });

  it("origin.ctrlKey 为 true", () => {
    expect(isAdditiveSelect({ origin: { ctrlKey: true } })).toBe(true);
  });

  it("origin.metaKey 为 true", () => {
    expect(isAdditiveSelect({ origin: { metaKey: true } })).toBe(true);
  });

  it("origin.shiftKey 为 true", () => {
    expect(isAdditiveSelect({ origin: { shiftKey: true } })).toBe(true);
  });
});
