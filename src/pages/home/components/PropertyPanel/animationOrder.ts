import type { CanvasAnimationItem, CanvasAnimationPreset } from "@/types";

/** 动画在时间轴上的阶段：淡入最先，移动居中，淡出最后。 */
export type AnimationStage = "enter" | "move" | "exit";

export const getAnimationStage = (preset: CanvasAnimationPreset): AnimationStage => {
  if (preset === "fadeIn") return "enter";
  if (preset === "fadeOut") return "exit";

  return "move";
};

export const moveItem = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);

  if (!item) return list;

  next.splice(to, 0, item);

  return next;
};

/**
 * 按淡入 -> 移动/旋转 -> 淡出重排，同阶段内保持原有相对顺序。
 * 拖动后即使用户把淡入放到中间，也会被纠正回合法时机。
 */
export const sortAnimationsByStage = (list: CanvasAnimationItem[]) => {
  const enter: CanvasAnimationItem[] = [];
  const move: CanvasAnimationItem[] = [];
  const exit: CanvasAnimationItem[] = [];

  list.forEach((item) => {
    const stage = getAnimationStage(item.preset);

    if (stage === "enter") enter.push(item);
    else if (stage === "exit") exit.push(item);
    else move.push(item);
  });

  return [...enter.slice(0, 1), ...move, ...exit.slice(0, 1)];
};

export const hasAnimationPreset = (
  list: CanvasAnimationItem[],
  preset: CanvasAnimationPreset,
  exceptId?: string,
) => list.some((item) => item.preset === preset && item.id !== exceptId);

export const canSelectAnimationPreset = (
  list: CanvasAnimationItem[],
  itemId: string,
  preset: CanvasAnimationPreset,
) => {
  if (preset !== "fadeIn" && preset !== "fadeOut") return true;

  return !hasAnimationPreset(list, preset, itemId);
};

/** 无限循环会占住时间轴，只有最后一条才允许开启。 */
export const canUseInfiniteLoop = (list: CanvasAnimationItem[], itemId: string) =>
  list.at(-1)?.id === itemId;

export const reorderAnimations = (list: CanvasAnimationItem[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }

  return applyAnimationListRules(moveItem(list, from, to));
};

/** 纠正阶段顺序，并清掉非最后一条上的无限循环。 */
export const applyAnimationListRules = (list: CanvasAnimationItem[]) => {
  const sorted = sortAnimationsByStage(list);

  return sorted.map((item, index) => {
    if (item.loop >= 0 || index === sorted.length - 1) return item;

    return {
      ...item,
      loop: 0,
    };
  });
};
