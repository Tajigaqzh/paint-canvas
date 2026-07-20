import type { IUI, IUIInputData } from "leafer-ui";
import type { Patch } from "immer";

/** 画布节点类型。group 是真实层级节点，不是普通标签。 */
export type CanvasNodeKind = "rect" | "ellipse" | "text" | "group";

/** 画布固定设计尺寸。DOM 会等比缩放，数据始终按这个坐标系存储。 */
export interface CanvasViewport {
  /** 画布设计宽度，当前按 1920 设计。 */
  width: number;
  /** 画布设计高度，当前按 1080 设计。 */
  height: number;
}

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
  /** 矩形圆角。 */
  cornerRadius?: number;
}

/** 椭圆节点。 */
export interface EllipseNode extends CanvasNodeBase {
  /** 节点类型固定为椭圆。 */
  kind: "ellipse";
  /** 椭圆外接矩形宽度。 */
  width: number;
  /** 椭圆外接矩形高度。 */
  height: number;
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
export type CanvasNode = RectNode | EllipseNode | TextNode | GroupNode;

/** 画布文档状态。 */
export interface CanvasDocument {
  /** 固定画布尺寸，当前默认 1920 x 1080。 */
  viewport: CanvasViewport;
  /** 所有节点字典，key 是节点 ID。 */
  nodeMap: Record<string, CanvasNode>;
  /** 根层级节点 ID 列表，顺序就是根图层顺序。 */
  rootIds: string[];
  /** 当前选中的节点 ID 列表，支持多选。 */
  selectedIds: string[];
  /** 主选中节点 ID，属性面板展示它。 */
  activeId?: string;
}

/** 一次可撤销操作。 */
export interface CanvasHistoryEntry {
  /** 正向 patches，用于重做。 */
  patches: Patch[];
  /** 反向 patches，用于撤销。 */
  inversePatches: Patch[];
}

/** 撤销/重做历史状态。 */
export interface CanvasHistoryState {
  /** 撤销栈，保存过去操作。 */
  past: CanvasHistoryEntry[];
  /** 重做栈，保存被撤销后可恢复的操作。 */
  future: CanvasHistoryEntry[];
  /** 最大历史步数。 */
  limit: number;
}

/** 画布 store 对外暴露的状态和动作。 */
export interface CanvasStore extends CanvasDocument {
  /** 当前选择是否满足打组条件；只有同父级的多个节点才能打组。 */
  canGroup: boolean;
  /** 是否存在可重做历史。 */
  canRedo: boolean;
  /** 当前选择中是否包含组节点。 */
  canUngroup: boolean;
  /** 是否存在可撤销历史。 */
  canUndo: boolean;
  /** 添加一个根层级节点，并自动选中新节点。 */
  addNode(kind: Exclude<CanvasNodeKind, "group">): void;
  /** 将节点在同级图层中上移一层。 */
  bringForward(id?: string): void;
  /** 将当前同父级的多选节点包进一个 group 节点。 */
  groupSelected(): void;
  /** 重做最近一次撤销操作。 */
  redo(): void;
  /** 重置文档和历史栈。 */
  reset(): void;
  /** 选择节点；additive 为 true 时用于 Ctrl/Shift 多选切换。 */
  selectNode(id?: string, additive?: boolean): void;
  /** 用编辑器框选结果直接覆盖当前选区，ids 顺序会决定属性面板的主选中节点。 */
  selectNodes(ids: string[]): void;
  /** 将节点在同级图层中下移一层。 */
  sendBackward(id?: string): void;
  /** 拆开当前选中的组，并把子节点放回组原来的同级位置。 */
  ungroupSelected(): void;
  /** 撤销最近一次可记录操作。 */
  undo(): void;
  /** 更新节点属性，进入历史栈；元素和 group 的基础字段都通过这里写入。 */
  updateNode(id: string, data: Partial<CanvasNode>): void;
}

export type EditorHandle = {
  /** 取消 Leafer 编辑器当前选择。 */
  cancel(): void;
  /** 监听 Leafer editor 插件事件。 */
  on(type: string, listener: (event: unknown) => void): void;
  /** 让 Leafer 编辑器显示单选或多选控制框。 */
  select(target: IUI | IUI[]): void;
};

export type EditableNodeUI = IUI & {
  /** Leafer UI 节点的批量属性更新方法，用于同步 store 数据。 */
  set(data: Record<string, number | string | boolean | undefined>): void;
};
