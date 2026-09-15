import type { IPointData, IUI } from "@leafer-ui/interface";

/** App / 容器的结构化视图，避免和宿主的具体泛型耦合。 */
type CanvasView = { canvas?: { view?: HTMLCanvasElement } | null };

/** 取容器所在的那块画布。 */
const getContainerCanvas = (container: IUI) =>
  (container as unknown as { leafer?: CanvasView }).leafer?.canvas?.view;

/** 默认的指针监听元素：容器所在画布的父容器。 */
export const getContainerView = (container: IUI): HTMLElement | undefined => {
  const canvas = getContainerCanvas(container);

  return canvas?.parentElement ?? canvas ?? undefined;
};

/**
 * 把 DOM 指针事件换算成容器局部坐标。
 *
 * 两步：
 * 1. client 坐标减去画布的 client 边界，得到画布像素坐标。
 * 2. 用容器自己的世界变换求逆（getInnerPoint），换算到容器局部坐标。
 *
 * 注意不要用 `getWorldPointByPage`：它把入参当成「该 Leafer 自身的局部坐标」，
 * 在「缩放挂在 app.tree 上、容器是它的子元素」这种结构下不会做画布像素到世界的换算（实测确认）。
 * 这样插件不需要知道宿主的画布缩放、居中偏移或设备像素比。
 */
export const toContainerPoint = (container: IUI, event: PointerEvent): IPointData | undefined => {
  const canvas = getContainerCanvas(container);

  if (!canvas) return undefined;

  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return undefined;

  const point = container.getInnerPoint({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });

  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;

  return point;
};
