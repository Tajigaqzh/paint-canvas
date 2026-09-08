import { describe, expect, it } from "vitest";
import type { CanvasAnimationItem } from "@/types";
import { getAnimationSignature, getLeaferAnimation } from "../animation";

const item = (overrides: Partial<CanvasAnimationItem> = {}): CanvasAnimationItem => ({
  animation: { style: { opacity: 1 } },
  delay: 100,
  duration: 200,
  id: "a",
  loop: 0,
  name: "a",
  preset: "fadeIn",
  ...overrides,
});

describe("getLeaferAnimation", () => {
  it("undefined 返回 undefined", () => {
    expect(getLeaferAnimation(undefined)).toBeUndefined();
  });

  it("空数组返回 undefined", () => {
    expect(getLeaferAnimation([])).toBeUndefined();
  });

  it("单条动画返回对象而不是数组", () => {
    const result = getLeaferAnimation([item()]);
    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({ delay: 0.1, duration: 0.2, loop: false });
  });

  it("loop 为 -1 时 Leafer loop 为 true", () => {
    const result = getLeaferAnimation([item({ loop: -1 })]);
    expect(result).toMatchObject({ loop: true });
  });

  it("loop 大于 0 时透传次数", () => {
    const result = getLeaferAnimation([item({ loop: 3 })]);
    expect(result).toMatchObject({ loop: 3 });
  });

  it("多条动画返回数组并累加 delay", () => {
    const result = getLeaferAnimation([item({ delay: 100, duration: 100 }), item({ delay: 0, duration: 50 })]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result?.[1]).toMatchObject({ delay: 0.2 });
  });

  it("keyframes 会把毫秒换成秒", () => {
    const result = getLeaferAnimation([
      item({
        animation: {
          keyframes: [{ style: { x: 1 }, duration: 1000, delay: 500 }],
        },
      }),
    ]);
    expect(result).toMatchObject({
      keyframes: [{ style: { x: 1 }, duration: 1, delay: 0.5 }],
    });
  });
});

describe("getAnimationSignature", () => {
  it("undefined 序列化成空数组", () => {
    expect(getAnimationSignature(undefined)).toBe("[]");
  });

  it("相同列表签名一致", () => {
    const list = [item()];
    expect(getAnimationSignature(list)).toBe(getAnimationSignature(list));
  });
});
