import { describe, expect, it } from "vitest";
import { getNormalizedLineNodeInput } from "../brush";

describe("getNormalizedLineNodeInput", () => {
  it("空数组返回 undefined", () => {
    expect(getNormalizedLineNodeInput([], 4)).toBeUndefined();
  });

  it("单个数字不足以成对点", () => {
    expect(getNormalizedLineNodeInput([1], 4)).toBeUndefined();
  });

  it("一个点会补成极短线段", () => {
    const result = getNormalizedLineNodeInput([10, 20], 8);
    expect(result?.points?.length).toBe(4);
    expect(result?.x).toBe(10);
    expect(result?.y).toBe(20);
    expect(result?.strokeWidth).toBe(8);
  });

  it("多个点转成相对左上角的局部坐标", () => {
    const result = getNormalizedLineNodeInput([10, 10, 20, 30], 4);
    expect(result?.x).toBe(10);
    expect(result?.y).toBe(10);
    expect(result?.width).toBe(10);
    expect(result?.height).toBe(20);
    expect(result?.points).toEqual([0, 0, 10, 20]);
  });
});
