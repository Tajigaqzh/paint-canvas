import type { IPointData, IUI } from "@leafer-ui/interface";

/** 能承载子元素的容器（画板 Frame / group），插件把预览画在它里面。 */
export type DrawContainer = IUI & {
  add(child: IUI, index?: number): void;
  remove?(child?: IUI, destroy?: boolean): void;
};

/** 一次笔迹的几何与样式；坐标都已经归一化到笔迹自己的局部空间。 */
export type BrushDrawEvent = {
  /** 外接矩形左上角在容器里的坐标。 */
  height: number;
  /** 相对外接矩形左上角的点序列，按 x/y 成对排列。 */
  points: number[];
  /** 描边颜色。 */
  stroke: string;
  /** 描边宽度，单位是容器局部坐标。 */
  strokeWidth: number;
  width: number;
  x: number;
  y: number;
};

export type BrushConfig = {
  /** 笔迹落在哪个 Leafer 容器里，坐标也按它的局部空间算。 */
  container: DrawContainer;
  /** 监听指针的元素，默认取容器的父容器。 */
  view?: HTMLElement | null;
  /** 是否启用，默认 true。 */
  enabled?: boolean;
  /** 描边颜色，默认 #111827。 */
  stroke?: string;
  /** 描边宽度（容器局部坐标），默认 8。 */
  strokeWidth?: number;
  /** 采样节流距离，小于它的相邻点会被丢掉，默认 2。 */
  minDistance?: number;
  /** 透传给 Leafer Line 的曲线平滑度，默认 0.2。 */
  curve?: number;
};

/** 一次擦除命中的结果；宿主用它反查自己的节点并记录擦除轨迹。 */
export type EraserEraseEvent = {
  /** 预览插入的容器（一般是被擦元素的父级），也是 points 的坐标空间。 */
  container: IUI;
  /** 目标包围盒相对 container 的偏移，方便宿主换算成节点局部坐标。 */
  offset: IPointData;
  /** 相对 container 的擦除轨迹，按 x/y 成对排列。 */
  points: number[];
  /** 擦除宽度。 */
  strokeWidth: number;
  /** 直接命中的元素，通常是节点内部的图形子元素。 */
  target: IUI;
};

export type EraserConfig = {
  /** 擦除发生在哪个 Leafer 容器里，坐标也按它的局部空间算。 */
  container: DrawContainer;
  /** 监听指针的元素，默认取容器的父容器。 */
  view?: HTMLElement | null;
  /** 是否启用，默认 true。 */
  enabled?: boolean;
  /** 擦除宽度（容器局部坐标），默认 24。 */
  strokeWidth?: number;
  /** 采样节流距离，默认 2。 */
  minDistance?: number;
  /** 哪些元素可以被擦除；默认任何命中的元素都可以。 */
  erasable?: (target: IUI) => boolean;
  /** 拖动时是否实时预览擦除效果，默认 true。 */
  preview?: boolean;
};
