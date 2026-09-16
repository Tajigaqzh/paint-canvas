import type {
  CanvasAnimationItem,
  CanvasAnimationPreset,
  CanvasFadeInDirection,
  CanvasMovePreset,
} from "@/types";

export const animationPresetOptions: Array<{
  label: string;
  value: CanvasAnimationPreset;
}> = [
  { label: "淡入", value: "fadeIn" },
  { label: "淡出", value: "fadeOut" },
  { label: "移动", value: "move" },
  { label: "旋转", value: "rotate" },
];

export const fadeInDirectionOptions: Array<{
  label: string;
  value: CanvasFadeInDirection;
}> = [
  { label: "从当前位置", value: "current" },
  { label: "从左边", value: "left" },
  { label: "从上边", value: "top" },
  { label: "从下边", value: "bottom" },
];

export const fadeOutDirectionOptions: Array<{
  label: string;
  value: CanvasFadeInDirection;
}> = [
  { label: "在当前位置", value: "current" },
  { label: "向左边", value: "left" },
  { label: "向上边", value: "top" },
  { label: "向下边", value: "bottom" },
];

export const movePresetOptions: Array<{ label: string; value: CanvasMovePreset }> = [
  { label: "自定义", value: "custom" },
  { label: "右移", value: "right" },
  { label: "左移", value: "left" },
  { label: "上移", value: "up" },
  { label: "下移", value: "down" },
  { label: "左上 → 右下", value: "topLeftToBottomRight" },
  { label: "右下 → 左上", value: "bottomRightToTopLeft" },
  { label: "右上 → 左下", value: "topRightToBottomLeft" },
  { label: "左下 → 右上", value: "bottomLeftToTopRight" },
];

const getFadeOffset = (direction: CanvasFadeInDirection, distance: number) => {
  if (direction === "left") return { offsetX: -distance };
  if (direction === "top") return { offsetY: -distance };
  if (direction === "bottom") return { offsetY: distance };

  return {};
};

/** 把面板上的动画配置翻译成 Leafer 原生 animation 数据。 */
export const createAnimationData = (
  item: Pick<
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
  >,
): CanvasAnimationItem["animation"] => {
  const { delay, duration, loop, preset } = item;

  if (preset === "rotate") {
    return {
      delay,
      duration,
      keyframes: [{ style: { rotation: 0 } }, { style: { rotation: 360 } }],
      loop,
    };
  }

  if (preset === "move" || preset === "slideRight") {
    const movePreset = item.movePreset ?? "right";
    const distance = item.moveDistance ?? 80;
    const presetOffsets: Record<CanvasMovePreset, [number, number, number, number]> = {
      custom: [item.moveFromX ?? 0, item.moveFromY ?? 0, item.moveToX ?? 80, item.moveToY ?? 0],
      right: [0, 0, distance, 0],
      left: [0, 0, -distance, 0],
      up: [0, 0, 0, -distance],
      down: [0, 0, 0, distance],
      topLeftToBottomRight: [-distance, -distance, distance, distance],
      bottomRightToTopLeft: [distance, distance, -distance, -distance],
      topRightToBottomLeft: [distance, -distance, -distance, distance],
      bottomLeftToTopRight: [-distance, distance, distance, -distance],
    };
    const [fromX, fromY, toX, toY] = presetOffsets[movePreset];

    return {
      delay,
      duration,
      keyframes: [
        { style: { offsetX: fromX, offsetY: fromY } },
        { style: { offsetX: toX, offsetY: toY } },
      ],
      loop,
    };
  }

  if (preset === "fadeOut") {
    const fadeOutDirection = item.fadeInDirection ?? "current";
    const fadeOutDistance = item.fadeInDistance ?? 80;
    const fadeOutOffset = getFadeOffset(fadeOutDirection, fadeOutDistance);

    return {
      delay,
      duration,
      keyframes: [
        { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
        { style: { opacity: 0, ...fadeOutOffset } },
      ],
      loop,
    };
  }

  const fadeInDirection = item.fadeInDirection ?? "current";
  const fadeInDistance = item.fadeInDistance ?? 80;
  const fadeInOffset = getFadeOffset(fadeInDirection, fadeInDistance);

  return {
    delay,
    duration,
    keyframes: [
      { style: { opacity: 0, ...fadeInOffset } },
      { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
    ],
    loop,
  };
};

export const getAnimationName = (preset: CanvasAnimationPreset) => {
  if (preset === "fadeOut") return "淡出动画";
  if (preset === "move" || preset === "slideRight") return "移动动画";
  if (preset === "rotate") return "旋转动画";

  return "淡入动画";
};

/** 新增一条动画：已有淡入则补移动，否则补淡入，保证阶段顺序合法。 */
export const createAnimationItem = (list: CanvasAnimationItem[]): CanvasAnimationItem => {
  const preset: CanvasAnimationPreset = list.some((item) => item.preset === "fadeIn")
    ? "move"
    : "fadeIn";
  const item: Omit<CanvasAnimationItem, "animation"> = {
    delay: 0,
    duration: 600,
    fadeInDirection: "current",
    fadeInDistance: 80,
    id: `animation-${Date.now()}`,
    loop: 0,
    name: getAnimationName(preset),
    preset,
    movePreset: "right",
    moveDistance: 80,
    moveFromX: 0,
    moveFromY: 0,
    moveToX: 80,
    moveToY: 0,
  };

  return {
    ...item,
    animation: createAnimationData(item),
  };
};

/** 改动画配置：补齐该预设的默认字段、按需重命名、重算 Leafer animation。 */
export const patchAnimationItem = (
  item: CanvasAnimationItem,
  data: Partial<CanvasAnimationItem>,
) => {
  const next: CanvasAnimationItem = { ...item, ...data };

  if (next.preset === "move" || next.preset === "slideRight") {
    next.movePreset = next.movePreset ?? "right";
    next.moveDistance = next.moveDistance ?? 80;
    next.moveFromX = next.moveFromX ?? 0;
    next.moveFromY = next.moveFromY ?? 0;
    next.moveToX = next.moveToX ?? 80;
    next.moveToY = next.moveToY ?? 0;
  }

  if (next.preset === "fadeIn" || next.preset === "fadeOut") {
    next.fadeInDirection = next.fadeInDirection ?? "current";
    next.fadeInDistance = next.fadeInDistance ?? 80;
  }

  if (data.preset && data.preset !== item.preset && item.name === getAnimationName(item.preset)) {
    next.name = getAnimationName(next.preset);
  }

  return {
    ...next,
    animation: createAnimationData(next),
  };
};
