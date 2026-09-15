import type { MagnifierSample } from "./types";

/** 镜片画布只需要尺寸和 2d 上下文；用 Pick 保留 HTMLCanvasElement 的 getContext 重载。 */
export type MagnifierLensCanvas = Pick<HTMLCanvasElement, "getContext" | "height" | "width">;

/** 取正值兜底，避免传入 0 / 负数时出现除零或零尺寸画布。 */
const toPositive = (value: number) => (value > 0 ? value : 1);

/**
 * 计算镜片要从源画布截取的区域。
 *
 * 采样边长按「屏幕视觉倍数」反推：镜片覆盖多少屏幕像素就放大多少倍，
 * 所以倍率和画布自身的缩放比例无关，用户看到的就是相对当前画面的放大效果。
 * 指针始终是取样区域的中心，因此越界不夹紧，交给 drawImage 裁掉，再由白底补齐。
 */
export const getMagnifierSample = (
  offset: { x: number; y: number },
  size: number,
  zoom: number,
  pixelRatio: number,
): MagnifierSample => {
  const ratio = toPositive(pixelRatio);
  // sourceLength 是取样区域边长：镜片直径 / 倍率，再换算成源画布的设备像素。
  const sourceLength = (size / toPositive(zoom)) * ratio;

  return {
    sx: offset.x * ratio - sourceLength / 2,
    sy: offset.y * ratio - sourceLength / 2,
    sh: sourceLength,
    sw: sourceLength,
  };
};

/**
 * 把源画布的局部区域放大绘制到镜片画布上。
 *
 * 先铺白底：指针停在画布边缘时取样区域会超出源画布，drawImage 只画重叠部分，
 * 剩余像素由白底补齐，不会露出镜片的透明背景。
 */
export const drawMagnifierLens = (
  lens: MagnifierLensCanvas,
  source: CanvasImageSource,
  size: number,
  sample: MagnifierSample,
  pixelRatio: number,
): void => {
  // 镜片画布按设备像素放大，否则高分屏上绘制结果会被拉伸模糊。
  const deviceSize = Math.max(1, Math.round(size * toPositive(pixelRatio)));

  if (lens.width !== deviceSize || lens.height !== deviceSize) {
    // 给 width / height 赋值会清空画布，所以只在尺寸真的变化时写入。
    lens.width = deviceSize;
    lens.height = deviceSize;
  }

  const context = lens.getContext("2d");

  if (!context) return;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, deviceSize, deviceSize);
  context.drawImage(
    source,
    sample.sx,
    sample.sy,
    sample.sw,
    sample.sh,
    0,
    0,
    deviceSize,
    deviceSize,
  );
};
