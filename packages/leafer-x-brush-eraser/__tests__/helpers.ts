import type { ISelector, IUI } from "@leafer-ui/interface";

export const toRect = (left: number, top: number, width: number, height: number) =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top,
  }) as DOMRect;

type FakeLeaf = {
  add(child: unknown): void;
  children: unknown[];
  getInnerPoint(point: { x: number; y: number }): { x: number; y: number };
  getWorldPoint(point: { x: number; y: number }): { x: number; y: number };
  leafer: { canvas: { view: HTMLCanvasElement }; selector?: ISelector };
  remove(child: unknown): void;
};

/**
 * 造一个「容器挂在 Leafer 画布上」的最小环境。
 *
 * 坐标换算在单测里做恒等映射（画布像素 -> 容器局部），所以断言里的坐标就是 client 减画布左上角。
 */
export const createContainer = (canvasRect = toRect(0, 0, 960, 540)) => {
  const view = document.createElement("div");
  const canvas = document.createElement("canvas");
  const children: unknown[] = [];

  canvas.getBoundingClientRect = () => canvasRect;
  view.appendChild(canvas);
  document.body.appendChild(view);

  const container = {
    add: (child: unknown) => {
      children.push(child);
    },
    children,
    getInnerPoint: (point: { x: number; y: number }) => point,
    getWorldPoint: (point: { x: number; y: number }) => point,
    leafer: { canvas: { view: canvas } },
    remove: (child: unknown) => {
      const index = children.indexOf(child);

      if (index >= 0) children.splice(index, 1);
    },
  } as unknown as FakeLeaf & IUI;

  return { canvas, children, container, view };
};

type PointerOptions = {
  button?: number;
  clientX?: number;
  clientY?: number;
  pointerId?: number;
};

/** jsdom 没有 PointerEvent，用普通事件补上插件用到的字段。 */
export const dispatchPointer = (
  target: EventTarget,
  type: string,
  { button = 0, clientX = 0, clientY = 0, pointerId = 1 }: PointerOptions = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.assign(event, { button, clientX, clientY, pointerId });
  target.dispatchEvent(event);

  return event as PointerEvent;
};

/** 造一个能承载擦除预览的容器（目标父级）。 */
export const createEraseContainer = () => {
  const children: unknown[] = [];

  return {
    add: (child: unknown) => {
      children.push(child);
    },
    children,
    getInnerPoint: (point: { x: number; y: number }) => point,
  };
};

/** 造一个会被命中的目标元素。 */
export const createTarget = (parent: unknown, bounds = { height: 50, width: 100, x: 10, y: 20 }) =>
  ({
    getBounds: () => bounds,
    parent,
  }) as unknown as IUI;
