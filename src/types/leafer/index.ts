import type { RefObject } from "react";
import type { App as LeaferApp, Frame, Group, IUI, Line } from "leafer-ui";
import type {
  CanvasLineEraserUpdate,
  CanvasNodeUpdate,
  CanvasPage,
  CanvasToolMode,
} from "@/types/canvas";
import type { EditableNodeUI, EditorHandle } from "@/types/edit";
import type { CanvasNode, LineNode } from "@/types/elementNode";

/** 注册 @leafer-in/editor 后带有 editor 实例的 LeaferApp。 */
export type EditableLeaferApp = LeaferApp & {
  /** @leafer-in/editor 注册后挂到 App 上的编辑器实例。 */
  editor?: EditorHandle;
};

/** Leafer 指针事件在不同平台/插件层包装后只暴露部分键盘修饰键信息。 */
export type PointerLikeEvent = {
  /** Windows/Linux 多选修饰键。 */
  ctrlKey?: boolean;
  /** macOS 多选修饰键。 */
  metaKey?: boolean;
  /** 备用多选修饰键。 */
  shiftKey?: boolean;
  /** Leafer 事件可能把原始 DOM 事件放在 origin 上。 */
  origin?: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  };
};

/** Home 组件传入 hook 的全部依赖；hook 本身不直接读 zustand，便于保持边界清晰。 */
export type UseLeaferCanvasOptions = {
  /** 当前工具配置；select 走 Leafer 编辑器，brush / eraser / magnifier 走自定义指针事件。 */
  tool: {
    /** 画笔真实落到 line 节点上的描边宽度，单位是业务画板坐标 px。 */
    brushSize: number;
    /** 橡皮擦真实写入 eraserPaths 的擦除宽度；cursor 视觉大小不在 hook 内生成。 */
    eraserSize: number;
    /** 放大镜镜片直径，单位是 DOM CSS 像素；镜片本身不是 Leafer 节点。 */
    magnifierSize: number;
    /** 放大镜相对当前画布显示的放大倍数，1 表示和屏幕上看到的一样大。 */
    magnifierZoom: number;
    /** 当前工具模式：select 使用 Leafer Editor，其它模式会拦截 pointer 事件。 */
    mode: CanvasToolMode;
  };
  /** 放大镜镜片的定位容器；镜片元素由 leafer-x-magnifier 自己创建，React 侧只提供容器。 */
  magnifierContainerRef: RefObject<HTMLElement | null>;
  /** 当前页面，是渲染 Leafer 的唯一数据源。 */
  page: CanvasPage;
  /** 画笔松手后提交一条完整笔迹。 */
  onAddDrawLine: (line: Omit<LineNode, "id" | "name">) => void;
  /** 橡皮擦松手后提交最终结果：普通节点删除，笔迹追加 eraser 轨迹。 */
  onApplyEraserResult: (deletedIds: string[], lineErasers: CanvasLineEraserUpdate[]) => void;
  /** 画布元素点击时同步选中状态。 */
  onSelectNode: (id?: string, additive?: boolean) => void;
  /** 编辑器框选完成时，把 Leafer 的选中 UI 数组同步回 store。 */
  onSelectNodes: (ids: string[]) => void;
  /** Leafer 拖拽/编辑结束后，把位置尺寸写回 store。 */
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
  /** Leafer 多选拖拽/编辑结束后，把多个节点作为一次历史记录写回 store。 */
  onUpdateNodes: (updates: CanvasNodeUpdate[]) => void;
  /** Leafer 挂载的 DOM 容器。 */
  viewRef: RefObject<HTMLDivElement | null>;
  /** Leafer 挂载容器的实际像素尺寸（画布 shell 的内容区，不含内边距），用于重算画板缩放、居中和标尺让位。 */
  viewSize?: {
    height: number;
    width: number;
  };
};

/** 文本内部编辑器关闭时会把最终文本放在 editTarget.text 上。 */
export type InnerEditorCloseEvent = {
  editTarget?: IUI & {
    text?: string | number;
  };
};

/** Leafer EditorEvent.SELECT 的事件负载，兼容 list 和 value 两种返回形态。 */
export type EditorSelectEvent = {
  /** EditorEvent.SELECT 返回的选中元素列表；无选中时为空数组。 */
  list?: IUI[];
  /** 某些场景只会给 value，这里作为 list 的兼容来源。 */
  value?: IUI | IUI[];
};

/** LeaferApp 的事件类型在当前依赖版本里没有完整暴露，这里只声明本 hook 用到的 on。 */
export type LeaferEventTarget = {
  on?(type: string, listener: (event: unknown) => void, bind?: unknown, capture?: boolean): unknown;
};

/** 业务坐标系里的点，单位是 1920 x 1080 画板坐标，不是 DOM 像素。 */
export type CanvasPoint = {
  x: number;
  y: number;
};

/** EditorHandle 的运行时对象还有 list，可用来判断当前 Editor 选择是否已经一致。 */
export type EditorSelectionHandle = EditorHandle & {
  /** 不绑定具体 IUI 版本，避免 @leafer-ui/interface 双版本导致类型不能互相赋值。 */
  list?: unknown[];
};

/** 能承载节点 UI 的 Leafer 父容器：根白板 Frame 或 group UI。 */
export type ParentNodeUI = (Group | Frame) & {
  /** 按图层顺序插入子 UI；index 越大越靠上。 */
  add(child: IUI, index?: number): void;
  /** Leafer 实际维护的子节点数组，用来判断是否需要重排。 */
  children?: IUI[];
  /** 从父容器移除子 UI；destroy=false 表示只移动实例，不销毁。 */
  remove(child?: IUI, destroy?: boolean): void;
};

/** 由本 hook 托管的节点 UI；group 还会作为子节点父容器参与增量排序。 */
export type ManagedNodeUI = EditableNodeUI & {
  /** group 节点会作为父容器承载 childrenIds 对应的子 UI。 */
  add?(child: IUI, index?: number): void;
  /** group 节点的实际子 UI 顺序。 */
  children?: IUI[];
  /** group / ungroup 或排序时用于移动子 UI。 */
  remove?(child?: IUI, destroy?: boolean): void;
  /** 增量同步节点属性时直接写入现有 Leafer UI。 */
  set(data: NodeUIInput): void;
  /** Leafer Image 用来显示缓存线程返回的 blob object URL。 */
  url?: string;
};

/**
 * line 节点在 Leafer 中不是直接渲染成一个 Line，而是渲染成 Group。
 *
 * 原因：
 * 1. 原始笔迹要保留，不能被橡皮擦直接 destroy。
 * 2. Leafer 的 eraser 需要作为同组上层子节点去擦下层笔迹。
 * 3. store 里只保存原始 points 和 eraserPaths，运行时再重建这些子节点。
 */
export type LineGroupUI = ManagedNodeUI & {
  /** 不可见的 eraser 占位节点，让 Leafer 从首次渲染就进入 eraser 合成路径。 */
  __eraserPrimer?: Line;
  /** 原始笔迹 Line，永远放在该 group 的最底层。 */
  __lineContent?: Line;
  /** 从 store.eraserPaths 重建出来的持久 eraser 子节点。 */
  __eraserContent?: Line[];
};

/** Leafer set / 构造函数可以接收多种属性；这里统一为宽松对象，避免每类 UI 拆类型。 */
export type NodeUIInput = Record<string, unknown>;
