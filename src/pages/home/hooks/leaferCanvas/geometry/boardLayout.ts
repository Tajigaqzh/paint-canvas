import type { CanvasPoint, CanvasViewport } from "@/types";

/** stage / 指针反算共用的画板布局：等比缩放 + 居中偏移。 */
export type BoardLayout = {
  boardX: number;
  boardY: number;
  scale: number;
};

/**
 * 画布视图顶部和左侧留给标尺刻度条的空间（屏幕像素）。
 *
 * leafer-x-ruler 把刻度条画在画布视图的左上角，白板贴边就会被刻度条压住，
 * 所以白板只在「视图减去这块空间」的区域里等比缩放。
 * 指针反算、舞台变换和标尺 ruleSize 共用这个值，鼠标落点才不会和看到的白板错开。
 */
export const BOARD_INSET = 20;

/**
 * 按 DOM 容器尺寸计算 1920×1080 业务画板在舞台上的缩放和居中。
 * 指针坐标反算必须用同一套公式，否则画笔落点和节点位置会对不齐。
 */
export const getBoardLayout = (
  viewWidth: number,
  viewHeight: number,
  viewport: CanvasViewport,
): BoardLayout => {
  // 先扣掉标尺刻度条占用的空间，再在剩余区域里等比缩放并居中。
  const availableWidth = Math.max(viewWidth - BOARD_INSET, 0);
  const availableHeight = Math.max(viewHeight - BOARD_INSET, 0);
  const scale = Math.min(availableWidth / viewport.width, availableHeight / viewport.height);

  return {
    boardX: BOARD_INSET + Math.max((availableWidth - viewport.width * scale) / 2, 0),
    boardY: BOARD_INSET + Math.max((availableHeight - viewport.height * scale) / 2, 0),
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
