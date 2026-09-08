import { describe, expect, it } from "vitest";
import { patchCornerRadius, toCornerRadiusValues } from "../utils";

describe("toCornerRadiusValues", () => {
  it("undefined 得到四个 0", () => {
    expect(toCornerRadiusValues(undefined)).toEqual([0, 0, 0, 0]);
  });

  it("单个数字复制到四角", () => {
    expect(toCornerRadiusValues(8)).toEqual([8, 8, 8, 8]);
  });

  it("两个值按对角复制", () => {
    expect(toCornerRadiusValues([1, 2])).toEqual([1, 2, 1, 2]);
  });

  it("三个值时左下用右上", () => {
    expect(toCornerRadiusValues([1, 2, 3])).toEqual([1, 2, 3, 2]);
  });

  it("四个值原样返回", () => {
    expect(toCornerRadiusValues([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});

describe("patchCornerRadius", () => {
  it("改左上角", () => {
    expect(patchCornerRadius(0, 0, 5)).toEqual([5, 0, 0, 0]);
  });

  it("null 写成 0", () => {
    expect(patchCornerRadius([4, 4, 4, 4], 1, null)).toEqual([4, 0, 4, 4]);
  });

  it("负数会被夹到 0", () => {
    expect(patchCornerRadius(undefined, 0, -3)).toEqual([0, 0, 0, 0]);
  });
});
