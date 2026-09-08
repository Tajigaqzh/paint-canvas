import { describe, expect, it } from "vitest";
import {
  applyAnimationListRules,
  canSelectAnimationPreset,
  canUseInfiniteLoop,
  getAnimationStage,
  hasAnimationPreset,
  moveItem,
  reorderAnimations,
  sortAnimationsByStage,
} from "../animationOrder";
import type { CanvasAnimationItem, CanvasAnimationPreset } from "@/types";

const item = (
  id: string,
  preset: CanvasAnimationPreset,
  loop = 0,
): CanvasAnimationItem => ({
  animation: { style: {} },
  delay: 0,
  duration: 200,
  id,
  loop,
  name: id,
  preset,
});

describe("getAnimationStage", () => {
  it("fadeIn 属于 enter", () => {
    expect(getAnimationStage("fadeIn")).toBe("enter");
  });

  it("fadeOut 属于 exit", () => {
    expect(getAnimationStage("fadeOut")).toBe("exit");
  });

  it("slideRight 属于 move", () => {
    expect(getAnimationStage("slideRight")).toBe("move");
  });

  it("rotate 属于 move", () => {
    expect(getAnimationStage("rotate")).toBe("move");
  });
});

describe("moveItem", () => {
  it("把第一项移到末尾", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("from 越界时返回原数组", () => {
    const list = ["a"];
    expect(moveItem(list, 3, 0)).toBe(list);
  });
});

describe("sortAnimationsByStage", () => {
  it("空列表返回空数组", () => {
    expect(sortAnimationsByStage([])).toEqual([]);
  });

  it("把乱序的淡入淡出纠正为 enter-move-exit", () => {
    const list = [item("out", "fadeOut"), item("move", "rotate"), item("in", "fadeIn")];
    expect(sortAnimationsByStage(list).map((entry) => entry.id)).toEqual(["in", "move", "out"]);
  });

  it("只保留一条淡入", () => {
    const list = [item("in-1", "fadeIn"), item("in-2", "fadeIn")];
    expect(sortAnimationsByStage(list).map((entry) => entry.id)).toEqual(["in-1"]);
  });
});

describe("hasAnimationPreset", () => {
  it("列表为空时返回 false", () => {
    expect(hasAnimationPreset([], "fadeIn")).toBe(false);
  });

  it("存在同预设时返回 true", () => {
    expect(hasAnimationPreset([item("in", "fadeIn")], "fadeIn")).toBe(true);
  });

  it("exceptId 排除自身后返回 false", () => {
    expect(hasAnimationPreset([item("in", "fadeIn")], "fadeIn", "in")).toBe(false);
  });
});

describe("canSelectAnimationPreset", () => {
  it("移动类预设始终可选", () => {
    expect(canSelectAnimationPreset([item("in", "fadeIn")], "move", "rotate")).toBe(true);
  });

  it("已有淡入时其它项不能再选 fadeIn", () => {
    expect(canSelectAnimationPreset([item("in", "fadeIn"), item("m", "rotate")], "m", "fadeIn")).toBe(
      false,
    );
  });

  it("当前项已是 fadeIn 时仍可选 fadeIn", () => {
    expect(canSelectAnimationPreset([item("in", "fadeIn")], "in", "fadeIn")).toBe(true);
  });
});

describe("canUseInfiniteLoop", () => {
  it("空列表返回 false", () => {
    expect(canUseInfiniteLoop([], "x")).toBe(false);
  });

  it("最后一项允许无限循环", () => {
    expect(canUseInfiniteLoop([item("a", "fadeIn"), item("b", "fadeOut")], "b")).toBe(true);
  });

  it("非最后一项不允许无限循环", () => {
    expect(canUseInfiniteLoop([item("a", "fadeIn"), item("b", "fadeOut")], "a")).toBe(false);
  });
});

describe("reorderAnimations", () => {
  it("from 等于 to 时返回原列表", () => {
    const list = [item("a", "rotate")];
    expect(reorderAnimations(list, 0, 0)).toBe(list);
  });

  it("from 为负数时返回原列表", () => {
    const list = [item("a", "rotate")];
    expect(reorderAnimations(list, -1, 0)).toBe(list);
  });

  it("to 越界时返回原列表", () => {
    const list = [item("a", "rotate")];
    expect(reorderAnimations(list, 0, 2)).toBe(list);
  });
});

describe("applyAnimationListRules", () => {
  it("清掉非最后一条上的无限循环", () => {
    const list = [item("in", "fadeIn", -1), item("out", "fadeOut", 0)];
    expect(applyAnimationListRules(list).map((entry) => entry.loop)).toEqual([0, 0]);
  });

  it("最后一条可以保留无限循环", () => {
    const list = [item("out", "fadeOut", -1)];
    expect(applyAnimationListRules(list)[0]?.loop).toBe(-1);
  });
});
