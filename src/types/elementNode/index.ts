import type { IUIInputData } from "leafer-ui";

/** 画布节点类型。group 是真实层级节点，不是普通标签。 */
export type CanvasNodeKind = "rect" | "ellipse" | "line" | "polygon" | "star" | "text" | "group";

/** 左侧素材面板可创建的图形类型。部分素材会映射到同一个画布节点类型。 */
export type CanvasMaterialKind =
  | "rect"
  | "text"
  | "line"
  | "triangle"
  | "polygon"
  | "star"
  | "circle"
  | "ellipse"
  | "ring"
  | "sector"
  | "sector-ring"
  | "arc";

/** 动画预设类型，右侧面板用它快速生成 Leafer animation 数据。 */
export type CanvasAnimationPreset = "fadeIn" | "slideRight" | "rotate";

/** 旋转/缩放基准点，对应 Leafer 的 origin 九宫格定位。 */
export type CanvasTransformOrigin =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

/** 描边线型。 */
export type CanvasStrokeStyle = "solid" | "dashed" | "dotted";

/** 描边相对节点路径的位置。 */
export type CanvasStrokeAlign = "inside" | "center" | "outside";

/** 描边端点形状。 */
export type CanvasStrokeCap = "none" | "round" | "square";

/** 椭圆节点的细分绘制模式。 */
export type CanvasEllipseMode = "circle" | "ellipse" | "ring" | "sector" | "sector-ring" | "arc";

/** 多边形节点的细分绘制模式。 */
export type CanvasPolygonMode = "triangle" | "polygon";

/** 矩形圆角。数组顺序遵循 Leafer: topLeft, topRight, bottomRight, bottomLeft。 */
export type CanvasCornerRadius =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number];

/** 节点上的单条动画配置；一个元素或组可以同时挂多条动画。 */
export interface CanvasAnimationItem {
  /** 动画唯一 ID，用于列表增删改，不参与 Leafer 渲染。 */
  id: string;
  /** 动画名称，显示在属性面板里，方便后续识别。 */
  name: string;
  /** 动画预设。不同预设会生成不同的 style 或 keyframes。 */
  preset: CanvasAnimationPreset;
  /** 动画持续时间，单位毫秒。 */
  duration: number;
  /** 动画开始前等待时间，单位毫秒。 */
  delay: number;
  /** 循环次数；0 表示不循环，-1 可作为无限循环的业务约定。 */
  loop: number;
  /** 动画进度定位，0 到 1。后续接入播放控制时可用于 seek。 */
  seek?: number;
  /** Leafer 原生 animation 数据，渲染时会透传给元素的 animation 属性。 */
  animation: {
    /** 单段目标样式动画。 */
    style?: IUIInputData;
    /** 关键帧动画。 */
    keyframes?: Array<{
      /** 当前关键帧要变化到的 Leafer 样式。 */
      style: IUIInputData;
      /** 当前关键帧持续时间，单位毫秒。 */
      duration?: number;
      /** 当前关键帧延时，单位毫秒。 */
      delay?: number;
    }>;
    /** 单条动画持续时间，单位毫秒。 */
    duration?: number;
    /** 单条动画延迟时间，单位毫秒。 */
    delay?: number;
    /** 单条动画循环次数。 */
    loop?: number;
  };
}

/** 所有节点共享的基础字段。 */
export interface CanvasNodeBase {
  /** 节点唯一 ID，用于状态、历史、Leafer 实例映射。 */
  id: string;
  /** 节点类型。 */
  kind: CanvasNodeKind;
  /** 图层/属性面板展示名称。 */
  name: string;
  /** 父组 ID；没有父级时表示位于画布根层级。 */
  parentId?: string;
  /** 是否锁定。 */
  locked?: boolean;
  /** 是否可见。 */
  visible?: boolean;
  /** X 坐标。 */
  x: number;
  /** Y 坐标。 */
  y: number;
  /** 旋转角度，单位是度；元素和组都使用同一字段。 */
  rotation?: number;
  /** 旋转/缩放基准点；默认 center，避免使用左上角作为旋转中心。 */
  transformOrigin?: CanvasTransformOrigin;
  /** 填充色。 */
  fill?: string;
  /** 描边颜色。strokeWidth 为 0 时不会显示描边，但颜色仍然会保留。 */
  stroke?: string;
  /** 描边宽度。0 表示不显示描边。 */
  strokeWidth?: number;
  /** 描边样式：实线、虚线或点线。 */
  strokeStyle?: CanvasStrokeStyle;
  /** 描边相对路径的位置，圆角弧线默认用 center。 */
  strokeAlign?: CanvasStrokeAlign;
  /** 描边端点形状，圆角弧线默认用 round。 */
  strokeCap?: CanvasStrokeCap;
  /** 动画列表；一个节点可以有多条动画，渲染时映射为 Leafer animation 数组。 */
  animationList?: CanvasAnimationItem[];
}

/** 矩形节点。 */
export interface RectNode extends CanvasNodeBase {
  /** 节点类型固定为矩形。 */
  kind: "rect";
  /** 矩形宽度。 */
  width: number;
  /** 矩形高度。 */
  height: number;
  /** 矩形圆角；支持统一圆角或 Leafer 的 2/3/4 值写法。 */
  cornerRadius?: CanvasCornerRadius;
}

/** 椭圆节点。 */
export interface EllipseNode extends CanvasNodeBase {
  /** 节点类型固定为椭圆。 */
  kind: "ellipse";
  /** 椭圆外接矩形宽度。 */
  width: number;
  /** 椭圆外接矩形高度。 */
  height: number;
  /** 椭圆绘制模式：普通椭圆、圆环、扇形、弧线。 */
  ellipseMode?: CanvasEllipseMode;
  /** 扇形和弧线的起始角度，单位是度。 */
  startAngle?: number;
  /** 扇形和弧线的结束角度，单位是度。 */
  endAngle?: number;
  /** 圆环内半径比例，0 到 1。 */
  innerRadius?: number;
  /** false 时只画开放弧线，不自动闭合到圆心。 */
  closed?: boolean;
  /** 扇形圆环的圆角半径。 */
  cornerRadius?: number;
}

/** 单条橡皮擦轨迹，配合 Leafer 的 eraser 属性在 line 自己的 Group 内擦除笔迹。 */
export interface LineEraserPath {
  /** Leafer eraser 轨迹点，按 x、y 成对排列，坐标相对所属 line 节点左上角。 */
  points: number[];
  /** 橡皮擦轨迹宽度；渲染为 eraser Line 的 strokeWidth。 */
  strokeWidth: number;
}

/** 线条节点。 */
export interface LineNode extends CanvasNodeBase {
  /** 节点类型固定为线条。 */
  kind: "line";
  /** 线条包围盒宽度，通常表示线条长度。 */
  width: number;
  /** 线条包围盒高度，直线通常为 0，曲线会使用非 0 高度。 */
  height: number;
  /** Leafer 折线路径点位数组，按 x、y 成对排列。 */
  points?: number[];
  /** 折线拐角圆角半径。 */
  cornerRadius?: number;
  /** 曲线开关或曲率数值；false 表示普通直线。 */
  curve?: boolean | number;
  /** 该线条内部的橡皮擦轨迹；渲染时作为 eraser Line 放在线条自己的 Group 内。 */
  eraserPaths?: LineEraserPath[];
}

/** 多边形节点。 */
export interface PolygonNode extends CanvasNodeBase {
  /** 节点类型固定为多边形。 */
  kind: "polygon";
  /** 多边形外接矩形宽度。 */
  width: number;
  /** 多边形外接矩形高度。 */
  height: number;
  /** 多边形绘制模式；triangle 会按三角形素材处理。 */
  polygonMode?: CanvasPolygonMode;
  /** 多边形边数。 */
  sides: number;
  /** 多边形顶点圆角半径。 */
  cornerRadius?: number;
}

/** 星形节点。 */
export interface StarNode extends CanvasNodeBase {
  /** 节点类型固定为星形。 */
  kind: "star";
  /** 星形外接矩形宽度。 */
  width: number;
  /** 星形外接矩形高度。 */
  height: number;
  /** 星形角数。 */
  corners: number;
  /** 星形内径比例，0 到 1。 */
  innerRadius?: number;
  /** 星形起始角度，单位是度。 */
  startAngle?: number;
  /** 星形顶点圆角半径。 */
  cornerRadius?: number;
}

/** 文本节点。 */
export interface TextNode extends CanvasNodeBase {
  /** 节点类型固定为文本。 */
  kind: "text";
  /** 文本内容。 */
  text: string;
  /** 字号。 */
  fontSize: number;
  /** 字重。 */
  fontWeight?: number;
}

/** 分组节点。childrenIds 决定组内层级顺序。 */
export interface GroupNode extends CanvasNodeBase {
  /** 节点类型固定为组。 */
  kind: "group";
  /** 组包围盒宽度，用于选区、旋转中心和属性面板展示。 */
  width: number;
  /** 组包围盒高度，用于选区、旋转中心和属性面板展示。 */
  height: number;
  /** 子节点 ID 列表，顺序就是组内图层顺序。 */
  childrenIds: string[];
}

/** 可序列化画布节点，不包含 Leafer 实例。 */
export type CanvasNode =
  | RectNode
  | EllipseNode
  | LineNode
  | PolygonNode
  | StarNode
  | TextNode
  | GroupNode;
