import type {
  CanvasAnimationItem,
  CanvasAnimationPreset,
  CanvasFadeInDirection,
  CanvasMovePreset,
} from "@/types";
import { translateKey } from "@/i18n";

export const animationPresetOptions: Array<{
  labelKey: string;
  value: CanvasAnimationPreset;
}> = [
  { labelKey: "fadeIn", value: "fadeIn" },
  { labelKey: "fadeOut", value: "fadeOut" },
  { labelKey: "move", value: "move" },
  { labelKey: "rotate", value: "rotate" },
];

export const fadeInDirectionOptions: Array<{
  labelKey: string;
  value: CanvasFadeInDirection;
}> = [
  { labelKey: "fromCurrentPosition", value: "current" },
  { labelKey: "fromLeft", value: "left" },
  { labelKey: "fromTop", value: "top" },
  { labelKey: "fromBottom", value: "bottom" },
];

export const fadeOutDirectionOptions: Array<{
  labelKey: string;
  value: CanvasFadeInDirection;
}> = [
  { labelKey: "atCurrentPosition", value: "current" },
  { labelKey: "toLeft", value: "left" },
  { labelKey: "toTop", value: "top" },
  { labelKey: "toBottom", value: "bottom" },
];

export const movePresetOptions: Array<{ labelKey: string; value: CanvasMovePreset }> = [
  { labelKey: "custom", value: "custom" },
  { labelKey: "moveRight", value: "right" },
  { labelKey: "moveLeft", value: "left" },
  { labelKey: "moveUp", value: "up" },
  { labelKey: "moveDown", value: "down" },
  { labelKey: "topLeftBottomRight", value: "topLeftToBottomRight" },
  { labelKey: "bottomRightTopLeft", value: "bottomRightToTopLeft" },
  { labelKey: "topRightBottomLeft", value: "topRightToBottomLeft" },
  { labelKey: "bottomLeftTopRight", value: "bottomLeftToTopRight" },
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
  if (preset === "fadeOut") return translateKey("fadeOutAnimation");
  if (preset === "move" || preset === "slideRight") return translateKey("moveAnimation");
  if (preset === "rotate") return translateKey("rotateAnimation");

  return translateKey("fadeInAnimation");
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
