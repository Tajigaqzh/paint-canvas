import type { CanvasPoint, CanvasViewport } from "@/types";

/** stage / 指针反算共用的画板布局：等比缩放 + 居中偏移。 */
export type BoardLayout = {
  boardX: number;
  boardY: number;
  scale: number;
};

/**
 * 按 DOM 容器尺寸计算 1920×1080 业务画板在舞台上的缩放和居中。
 * 指针坐标反算必须用同一套公式，否则画笔落点和节点位置会对不齐。
 */
export const getBoardLayout = (
  viewWidth: number,
  viewHeight: number,
  viewport: CanvasViewport,
): BoardLayout => {
  const scale = Math.min(viewWidth / viewport.width, viewHeight / viewport.height);

  return {
    boardX: Math.max((viewWidth - viewport.width * scale) / 2, 0),
    boardY: Math.max((viewHeight - viewport.height * scale) / 2, 0),
    scale,
  };
};

/** 判断业务坐标是否落在白色画板内。 */
export const isPointInViewport = (point: CanvasPoint, viewport: CanvasViewport) =>
  point.x >= 0 && point.y >= 0 && point.x <= viewport.width && point.y <= viewport.height;

/**
 * 把浏览器 client 坐标换成业务画板坐标。
 * 落在白板外时返回 undefined，画笔 / 橡皮擦不应启动。
 */
export const mapClientPointToBoard = (
  clientX: number,
  clientY: number,
  viewRect: DOMRect,
  layout: BoardLayout,
  viewport: CanvasViewport,
): CanvasPoint | undefined => {
  const point = {
    x: (clientX - viewRect.left - layout.boardX) / layout.scale,
    y: (clientY - viewRect.top - layout.boardY) / layout.scale,
  };

  if (!isPointInViewport(point, viewport)) return undefined;

  return point;
};
