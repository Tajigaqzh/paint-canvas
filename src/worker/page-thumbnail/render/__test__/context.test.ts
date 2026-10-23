import { describe, expect, it } from "vitest";
import { degreesToRadians, getCornerRadiusValues } from "../context";

describe("getCornerRadiusValues", () => {
  it("uses zero for an undefined radius", () => {
    expect(getCornerRadiusValues(undefined)).toEqual([0, 0, 0, 0]);
  });

  it("copies a scalar radius to every corner", () => {
    expect(getCornerRadiusValues(6)).toEqual([6, 6, 6, 6]);
  });

  it("fills a two-value radius using Leafer ordering", () => {
    expect(getCornerRadiusValues([1, 2])).toEqual([1, 2, 1, 2]);
  });

  it("fills a three-value radius using Leafer ordering", () => {
    expect(getCornerRadiusValues([1, 2, 3])).toEqual([1, 2, 3, 2]);
  });

  it("returns four-value radius unchanged", () => {
    expect(getCornerRadiusValues([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});

describe("degreesToRadians", () => {
  it("converts zero degrees", () => {
    expect(degreesToRadians(0)).toBe(0);
  });

  it("converts 180 degrees", () => {
    expect(degreesToRadians(180)).toBe(Math.PI);
  });

  it("converts negative degrees", () => {
    expect(degreesToRadians(-90)).toBe(-Math.PI / 2);
  });
});
