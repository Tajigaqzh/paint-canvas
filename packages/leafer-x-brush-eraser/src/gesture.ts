import type { IPointData } from "@leafer-ui/interface";
import { getPointDistance } from "./geometry";

export type GestureCallbacks = {
  /** 按下时触发；返回 false 表示这次手势不生效，后续 move / up 也不再接管。 */
  onStart(point: IPointData, event: PointerEvent): boolean | void;
  /** 采样到有效位移时触发。 */
  onMove(point: IPointData, event: PointerEvent): void;
  /** 抬手或手势取消时触发。 */
  onEnd(): void;
};

export type GestureOptions = {
  /** 监听 pointerdown 的元素。 */
  view: HTMLElement;
  /** 把 DOM 事件换算成容器局部坐标；返回 undefined 表示这次事件不算在容器里。 */
  toPoint(event: PointerEvent): IPointData | undefined;
  /** 采样节流距离。 */
  minDistance: number;
  /** 当前是否允许开始手势。 */
  isEnabled(): boolean;
};

export type PointerGesture = {
  attach(): void;
  detach(): void;
};

/**
 * 接管一段完整的 pointer 手势。
 *
 * pointerdown 绑在宿主给的元素上；pointermove / pointerup 绑到 window，
 * 保证指针拖出画布后也能正常结束，不会留下半截预览。
 */
export const createPointerGesture = (
  options: GestureOptions,
  callbacks: GestureCallbacks,
): PointerGesture => {
  let pointerId: number | undefined;
  let lastPoint: IPointData | undefined;

  const handleMove = (event: PointerEvent) => {
    if (pointerId === undefined || event.pointerId !== pointerId) return;

    const point = options.toPoint(event);

    if (!point) return;

    event.preventDefault();
    event.stopPropagation();

    // 采样节流：位移太小就不记，避免路径点爆炸。
    if (lastPoint && getPointDistance(lastPoint, point) < options.minDistance) return;

    lastPoint = point;
    callbacks.onMove(point, event);
  };

  const stop = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("pointermove", handleMove, true);
    window.removeEventListener("pointercancel", stop, true);
    window.removeEventListener("pointerup", stop, true);
    pointerId = undefined;
    lastPoint = undefined;
    callbacks.onEnd();
  };

  const handleUp = (event: PointerEvent) => {
    if (pointerId === undefined || event.pointerId !== pointerId) return;

    stop(event);
  };

  const handleDown = (event: PointerEvent) => {
    // 只接管主键，且同一时间只允许一段手势。
    if (!options.isEnabled() || pointerId !== undefined || event.button !== 0) return;

    const point = options.toPoint(event);

    if (!point) return;

    if (callbacks.onStart(point, event) === false) return;

    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    lastPoint = point;
    window.addEventListener("pointermove", handleMove, true);
    window.addEventListener("pointerup", handleUp, true);
    window.addEventListener("pointercancel", handleUp, true);
  };

  return {
    attach: () => {
      options.view.addEventListener("pointerdown", handleDown, true);
    },
    detach: () => {
      options.view.removeEventListener("pointerdown", handleDown, true);
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("pointerup", handleUp, true);
      window.removeEventListener("pointercancel", handleUp, true);
      pointerId = undefined;
      lastPoint = undefined;
    },
  };
};
