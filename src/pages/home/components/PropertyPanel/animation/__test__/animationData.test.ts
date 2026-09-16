import { describe, expect, it } from "vitest";
import type { CanvasAnimationItem } from "@/types";
import {
  createAnimationData,
  createAnimationItem,
  getAnimationName,
  patchAnimationItem,
} from "../animationData";

type AnimationInput = Pick<
  CanvasAnimationItem,
  | "delay"
  | "duration"
  | "fadeInDirection"
  | "fadeInDistance"
  | "loop"
  | "preset"
  | "movePreset"
  | "moveDistance"
  | "moveFromX"
  | "moveFromY"
  | "moveToX"
  | "moveToY"
>;

const baseInput: AnimationInput = {
  delay: 100,
  duration: 600,
  loop: 0,
  preset: "fadeIn",
};

describe("createAnimationData", () => {
  it("rotate 生成 0→360 旋转关键帧并透传时机参数", () => {
    const result = createAnimationData({ ...baseInput, preset: "rotate" });

    expect(result.delay).toBe(100);
    expect(result.duration).toBe(600);
    expect(result.loop).toBe(0);
    expect(result.keyframes).toEqual([{ style: { rotation: 0 } }, { style: { rotation: 360 } }]);
  });

  it("move 右移把结束点设为 distance", () => {
    const result = createAnimationData({
      ...baseInput,
      preset: "move",
      movePreset: "right",
      moveDistance: 120,
    });

    expect(result.keyframes).toEqual([
      { style: { offsetX: 0, offsetY: 0 } },
      { style: { offsetX: 120, offsetY: 0 } },
    ]);
  });

  it("move 左移把结束点设为 -distance", () => {
    const result = createAnimationData({
      ...baseInput,
      preset: "move",
      movePreset: "left",
      moveDistance: 120,
    });

    expect(result.keyframes).toEqual([
      { style: { offsetX: 0, offsetY: 0 } },
      { style: { offsetX: -120, offsetY: 0 } },
    ]);
  });

  it("move 自定义使用起止坐标", () => {
    const result = createAnimationData({
      ...baseInput,
      preset: "move",
      movePreset: "custom",
      moveFromX: -10,
      moveFromY: 20,
      moveToX: 30,
      moveToY: 40,
    });

    expect(result.keyframes).toEqual([
      { style: { offsetX: -10, offsetY: 20 } },
      { style: { offsetX: 30, offsetY: 40 } },
    ]);
  });

  it("slideRight 当作 move 处理", () => {
    const result = createAnimationData({ ...baseInput, preset: "slideRight" });

    expect(result.keyframes).toEqual([
      { style: { offsetX: 0, offsetY: 0 } },
      { style: { offsetX: 80, offsetY: 0 } },
    ]);
  });

  it("fadeIn 默认只做透明度变化", () => {
    const result = createAnimationData({ ...baseInput, preset: "fadeIn" });

    expect(result.keyframes).toEqual([
      { style: { opacity: 0 } },
      { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
    ]);
  });

  it("fadeIn 带方向时叠加滑入偏移", () => {
    const result = createAnimationData({
      ...baseInput,
      preset: "fadeIn",
      fadeInDirection: "top",
      fadeInDistance: 60,
    });

    expect(result.keyframes).toEqual([
      { style: { opacity: 0, offsetY: -60 } },
      { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
    ]);
  });

  it("fadeOut 从实到透明并叠加滑出偏移", () => {
    const result = createAnimationData({
      ...baseInput,
      preset: "fadeOut",
      fadeInDirection: "left",
      fadeInDistance: 40,
    });

    expect(result.keyframes).toEqual([
      { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
      { style: { opacity: 0, offsetX: -40 } },
    ]);
  });

  it("缺省距离回落到 80", () => {
    const result = createAnimationData({ ...baseInput, preset: "move" });

    expect(result.keyframes).toEqual([
      { style: { offsetX: 0, offsetY: 0 } },
      { style: { offsetX: 80, offsetY: 0 } },
    ]);
  });
});

describe("getAnimationName", () => {
  it("各预设返回对应中文名", () => {
    expect(getAnimationName("fadeIn")).toBe("淡入动画");
    expect(getAnimationName("fadeOut")).toBe("淡出动画");
    expect(getAnimationName("move")).toBe("移动动画");
    expect(getAnimationName("slideRight")).toBe("移动动画");
    expect(getAnimationName("rotate")).toBe("旋转动画");
  });
});

describe("createAnimationItem", () => {
  it("空列表时新增淡入动画", () => {
    const item = createAnimationItem([]);

    expect(item.preset).toBe("fadeIn");
    expect(item.name).toBe("淡入动画");
    expect(item.duration).toBe(600);
    expect(item.animation.keyframes).toBeTruthy();
  });

  it("已有淡入时新增移动动画，保证阶段顺序", () => {
    const item = createAnimationItem([{ ...baseInput, preset: "fadeIn" } as CanvasAnimationItem]);

    expect(item.preset).toBe("move");
    expect(item.name).toBe("移动动画");
  });
});

describe("patchAnimationItem", () => {
  it("切到 move 时自动补全移动默认字段并重算 animation", () => {
    const source = createAnimationItem([]);
    const patched = patchAnimationItem(source, { preset: "move" });

    expect(patched.preset).toBe("move");
    expect(patched.movePreset).toBe("right");
    expect(patched.moveDistance).toBe(80);
    expect(patched.animation.keyframes).toBeTruthy();
  });

  it("切预设且名称仍是旧预设默认名时同步改名", () => {
    const source = createAnimationItem([]);
    const patched = patchAnimationItem(source, { preset: "rotate" });

    expect(patched.name).toBe("旋转动画");
  });

  it("只改时长时保留其它配置并重算 animation", () => {
    const source = createAnimationItem([]);
    const patched = patchAnimationItem(source, { duration: 1200 });

    expect(patched.duration).toBe(1200);
    expect(patched.preset).toBe("fadeIn");
    expect(patched.animation.keyframes).toBeTruthy();
  });

  it("自定义名称后切预设不覆盖用户命名", () => {
    const source = createAnimationItem([]);
    const renamed = patchAnimationItem(source, { name: "我的淡入" });
    const patched = patchAnimationItem(renamed, { preset: "rotate" });

    expect(patched.name).toBe("我的淡入");
  });
});
