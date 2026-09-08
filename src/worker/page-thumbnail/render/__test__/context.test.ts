import { describe, expect, it } from "vitest";
import { degreesToRadians, getCornerRadiusValues } from "../context";

describe("getCornerRadiusValues", () => {
  it("undefined 得到四个 0", () => {
    expect(getCornerRadiusValues(undefined)).toEqual([0, 0, 0, 0]);
  });

  it("单个数字复制到四角", () => {
    expect(getCornerRadiusValues(6)).toEqual([6, 6, 6, 6]);
  });

  it("两个值按 Leafer 规则补齐", () => {
    expect(getCornerRadiusValues([1, 2])).toEqual([1, 2, 1, 2]);
  });

  it("三个值时左下用右上", () => {
    expect(getCornerRadiusValues([1, 2, 3])).toEqual([1, 2, 3, 2]);
  });

  it("四个值原样返回", () => {
    expect(getCornerRadiusValues([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});

describe("degreesToRadians", () => {
  it("0 度为 0", () => {
    expect(degreesToRadians(0)).toBe(0);
  });

  it("180 度为 π", () => {
    expect(degreesToRadians(180)).toBe(Math.PI);
  });

  it("负角度按公式换算", () => {
    expect(degreesToRadians(-90)).toBe(-Math.PI / 2);
  });
});
