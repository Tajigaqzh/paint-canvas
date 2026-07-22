import { useEffect, useRef } from "react";
import "@leafer-in/editor";
import "@leafer-in/text-editor";
import { EditorEvent, InnerEditorEvent } from "@leafer-in/editor";
import {
  App as LeaferApp,
  DragEvent,
  Ellipse,
  Frame,
  Group,
  Line,
  Polygon,
  Rect,
  Star,
  Text,
  type IUI,
} from "leafer-ui";
import type {
  CanvasLineEraserUpdate,
  CanvasNode,
  CanvasNodeUpdate,
  CanvasPage,
  CanvasToolMode,
  EditableNodeUI,
  EditorHandle,
  LineNode,
} from "@/types";

/**
 * 这个 hook 是 React store 和 Leafer 命令式场景树之间的桥。
 *
 * 设计原则：
 * 1. store 里的 CanvasPage 是唯一真实数据源。
 * 2. Leafer UI 实例只是渲染缓存，按 nodeId 增量同步。
 * 3. Leafer Editor 的选择层是插件内部结构，不能用 app.tree.clear() 误清掉。
 * 4. 用户触发的选择事件可以写回 store，代码主动调用 editor.select() 时不能反向写回。
 * 5. 画笔和橡皮擦是自定义 pointer 工具；鼠标 cursor 图标由 Home 层 DOM 样式处理。
 */

type EditableLeaferApp = LeaferApp & {
  /** @leafer-in/editor 注册后挂到 App 上的编辑器实例。 */
  editor?: EditorHandle;
};

/** Leafer 指针事件在不同平台/插件层包装后只暴露部分键盘修饰键信息。 */
type PointerLikeEvent = {
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
type UseLeaferCanvasOptions = {
  /** 当前工具配置；select 走 Leafer 编辑器，brush / eraser 走自定义指针事件。 */
  tool: {
    /** 画笔真实落到 line 节点上的描边宽度，单位是业务画板坐标 px。 */
    brushSize: number;
    /** 橡皮擦真实写入 eraserPaths 的擦除宽度；cursor 视觉大小不在 hook 内生成。 */
    eraserSize: number;
    /** 当前工具模式：select 使用 Leafer Editor，其它模式会拦截 pointer 事件。 */
    mode: CanvasToolMode;
  };
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
  viewRef: React.RefObject<HTMLDivElement | null>;
  /** 当前白色画板在页面里的实际像素尺寸，用于重新计算 1920 x 1080 的缩放比例。 */
  viewSize?: {
    height: number;
    width: number;
  };
};

/** 文本内部编辑器关闭时会把最终文本放在 editTarget.text 上。 */
type InnerEditorCloseEvent = {
  editTarget?: IUI & {
    text?: string | number;
  };
};

type EditorSelectEvent = {
  /** EditorEvent.SELECT 返回的选中元素列表；无选中时为空数组。 */
  list?: IUI[];
  /** 某些场景只会给 value，这里作为 list 的兼容来源。 */
  value?: IUI | IUI[];
};

/** LeaferApp 的事件类型在当前依赖版本里没有完整暴露，这里只声明本 hook 用到的 on。 */
type LeaferEventTarget = {
  on?(type: string, listener: (event: unknown) => void, bind?: unknown, capture?: boolean): unknown;
};

/** 业务坐标系里的点，单位是 1920 x 1080 画板坐标，不是 DOM 像素。 */
type CanvasPoint = {
  x: number;
  y: number;
};

/** brush / eraser 一次按下到松手之间的临时状态；这部分不进 store，松手时一次性提交历史。 */
type ToolDrawingState = {
  /** 橡皮擦当前手势已经命中的节点，避免一次拖动重复删除同一节点。 */
  erasedIds: Set<string>;
  /** line 节点的实时 eraser 预览；key 是 line id，value 是挂在 line group 内的临时 eraser Line。 */
  lineErasers: Map<string, LineEraserPreview>;
  /** 画笔采样点，按 x/y 成对保存，最终归一化为 LineNode.points。 */
  points: number[];
  /** 当前 pointerId，用来忽略其它手指或鼠标事件。 */
  pointerId: number;
  /** brush 拖动时画在 Leafer 上的临时线，松手后销毁并写入 store。 */
  tempLine?: Line;
};

/** EditorHandle 的运行时对象还有 list，可用来判断当前 Editor 选择是否已经一致。 */
type EditorSelectionHandle = EditorHandle & {
  list?: IUI[];
};

/** 能承载节点 UI 的 Leafer 父容器：根白板 Frame 或 group UI。 */
type ParentNodeUI = (Group | Frame) & {
  /** 按图层顺序插入子 UI；index 越大越靠上。 */
  add(child: IUI, index?: number): void;
  /** Leafer 实际维护的子节点数组，用来判断是否需要重排。 */
  children?: IUI[];
  /** 从父容器移除子 UI；destroy=false 表示只移动实例，不销毁。 */
  remove(child?: IUI, destroy?: boolean): void;
};

/** 由本 hook 托管的节点 UI；group 还会作为子节点父容器参与增量排序。 */
type ManagedNodeUI = EditableNodeUI & {
  /** group 节点会作为父容器承载 childrenIds 对应的子 UI。 */
  add?(child: IUI, index?: number): void;
  /** group 节点的实际子 UI 顺序。 */
  children?: IUI[];
  /** group / ungroup 或排序时用于移动子 UI。 */
  remove?(child?: IUI, destroy?: boolean): void;
  /** 增量同步节点属性时直接写入现有 Leafer UI。 */
  set(data: NodeUIInput): void;
};

/**
 * line 节点在 Leafer 中不是直接渲染成一个 Line，而是渲染成 Group。
 *
 * 原因：
 * 1. 原始笔迹要保留，不能被橡皮擦直接 destroy。
 * 2. Leafer 的 eraser 需要作为同组上层子节点去擦下层笔迹。
 * 3. store 里只保存原始 points 和 eraserPaths，运行时再重建这些子节点。
 */
type LineGroupUI = ManagedNodeUI & {
  /** 不可见的 eraser 占位节点，让 Leafer 从首次渲染就进入 eraser 合成路径。 */
  __eraserPrimer?: Line;
  /** 原始笔迹 Line，永远放在该 group 的最底层。 */
  __lineContent?: Line;
  /** 从 store.eraserPaths 重建出来的持久 eraser 子节点。 */
  __eraserContent?: Line[];
};

/** Leafer set / 构造函数可以接收多种属性；这里统一为宽松对象，避免每类 UI 拆类型。 */
type NodeUIInput = Record<string, unknown>;

/** findHitNode 返回的命中信息；offset 是命中节点所在父级到画板根的累计偏移。 */
type HitNodeResult = {
  /** 命中的业务节点 ID。 */
  id: string;
  /** 节点父级在画板坐标中的偏移，根层级为 0,0，组内节点会累加 group.x/y。 */
  offset: CanvasPoint;
};

/** 一条 line 在 eraser 拖动过程中的实时预览状态；松手后会转换为 CanvasLineEraserUpdate。 */
type LineEraserPreview = {
  /** line 节点自身相对父级的 x，用于把后续全局鼠标点转换为 line 内部点。 */
  nodeX: number;
  /** line 节点自身相对父级的 y，用于把后续全局鼠标点转换为 line 内部点。 */
  nodeY: number;
  /** 原 line 父级相对画板根的偏移，用于全局点和 store 局部坐标互转。 */
  parentOffset: CanvasPoint;
  /** 当前手势追加到该 line 上的局部 eraser 路径，松手时写入 store。 */
  path: number[];
  /** 运行时挂在 line group 内部的 eraser Line，用 Leafer 原生擦除能力实时预览。 */
  tempLine: Line;
};

/**
 * 将业务描边样式转换成 Leafer 可识别的 dashPattern。
 *
 * 业务节点只保存 strokeStyle 和 strokeWidth；Leafer 需要具体的虚线间隔数组。
 * 这里把 dashed / dotted 转成随线宽缩放的节奏，避免线越粗虚线看起来越密。
 */
const getStrokeDashPattern = (node: CanvasNode) => {
  // strokeWidth <= 0 表示业务上没有可见描边，不需要虚线配置。
  const width = Math.max(node.strokeWidth ?? 0, 0);

  // solid 不传 dashPattern，让 Leafer 使用默认实线。
  if (width <= 0) return undefined;
  // dashed 的节奏随线宽放大，避免粗线时虚线太密。
  if (node.strokeStyle === "dashed") return [width * 4, width * 2];
  // dotted 用短实线段模拟圆点；端点形状由 strokeCap 决定。
  if (node.strokeStyle === "dotted") return [width, width * 2];

  return undefined;
};

/**
 * 抽出所有图形共用的填充和描边属性。
 *
 * 创建 UI 和后续增量 set 都会调用它，保证 fill / stroke / dashPattern 等样式
 * 在新增节点和更新节点时走同一套映射逻辑。
 */
const getNodePaintInput = (node: CanvasNode) => ({
  dashPattern: getStrokeDashPattern(node),
  fill: node.fill,
  stroke: node.stroke,
  strokeAlign: node.strokeAlign,
  strokeCap: node.strokeCap,
  strokeWidth: node.strokeWidth,
});

/**
 * 将 store 中的可序列化节点转换为 Leafer UI 可直接 set / new 的属性。
 *
 * 这个方法只做“业务字段 -> Leafer 字段”的纯映射，不创建 UI，也不写 store。
 * 每种 kind 都在这里收敛自己的尺寸、文本、角度、points 等差异字段。
 */
const getNodeUIInput = (node: CanvasNode): NodeUIInput => {
  // 所有画布节点都允许选择和拖拽；非 select 工具会在 pointerdown 阶段拦截。
  const baseInput = {
    draggable: true,
    editable: true,
    ...getNodePaintInput(node),
    origin: node.transformOrigin ?? "center",
    rotation: node.rotation ?? 0,
    x: node.x,
    y: node.y,
  };

  // group 本身有包围盒和变换属性，子节点由 childrenIds 递归挂载。
  if (node.kind === "group") {
    return {
      ...baseInput,
      height: node.height,
      width: node.width,
    };
  }

  // 椭圆族包含圆、椭圆、圆环、扇形、弧线等，额外属性都映射给 Leafer Ellipse。
  if (node.kind === "ellipse") {
    return {
      ...baseInput,
      closed: node.closed,
      cornerRadius: node.cornerRadius,
      endAngle: node.endAngle,
      height: node.height,
      innerRadius: node.innerRadius,
      startAngle: node.startAngle,
      width: node.width,
    };
  }

  // 文本节点没有业务 width / height，位置和文本样式直接交给 Leafer Text。
  if (node.kind === "text") {
    return {
      ...baseInput,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      text: node.text,
    };
  }

  // line 在 Leafer 中用 Group 承载，points 会放到内部真实 Line 上。
  if (node.kind === "line") {
    return {
      ...baseInput,
      dashPattern: undefined,
      fill: "transparent",
      height: node.height,
      stroke: undefined,
      strokeWidth: 0,
      width: node.width,
    };
  }

  // 多边形使用 sides 和 cornerRadius 控制形态。
  if (node.kind === "polygon") {
    return {
      ...baseInput,
      cornerRadius: node.cornerRadius,
      height: node.height,
      sides: node.sides,
      width: node.width,
    };
  }

  // 星形使用 corners / innerRadius / startAngle 控制形态。
  if (node.kind === "star") {
    return {
      ...baseInput,
      cornerRadius: node.cornerRadius,
      corners: node.corners,
      height: node.height,
      innerRadius: node.innerRadius,
      startAngle: node.startAngle,
      width: node.width,
    };
  }

  // 剩余节点类型是矩形，支持宽高和圆角。
  return {
    ...baseInput,
    cornerRadius: node.cornerRadius,
    height: node.height,
    width: node.width,
  };
};

/**
 * 判断一次点击是否是“追加/切换选择”。
 *
 * Leafer 事件和原始 DOM 事件在不同浏览器里字段位置不完全一致，所以同时兼容
 * event.ctrlKey / metaKey / shiftKey 和 event.origin 上的同名字段。
 */
const isAdditiveSelect = (event: PointerLikeEvent) =>
  Boolean(
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.origin?.ctrlKey ||
    event.origin?.metaKey ||
    event.origin?.shiftKey,
  );

/**
 * 生成原始 line 子节点的渲染输入。
 *
 * line group 自己持有 node.x / node.y 和包围盒；内部真实 Line 只表达局部路径，
 * 所以这里固定 x=0、y=0、rotation=0，并把 node.points 作为局部坐标传给 Leafer。
 */
const getLineContentInput = (node: LineNode): NodeUIInput => ({
  ...getNodePaintInput(node),
  cornerRadius: node.cornerRadius,
  curve: node.curve,
  draggable: false,
  editable: false,
  fill: node.fill,
  height: node.height,
  origin: "top-left",
  points: node.points ? [...node.points] : undefined,
  rotation: 0,
  width: node.width,
  x: 0,
  y: 0,
});

/**
 * 生成单条 eraser 轨迹的 Leafer Line 输入。
 *
 * `eraser: "pixel"` 会让这条 Line 按描边像素擦除同 group 内更底层的内容。
 * points 只有一个点时补成极短线段，避免路径不成段导致 Leafer 不渲染擦除效果。
 */
const getLineEraserInput = (points: number[], strokeWidth: number): NodeUIInput => ({
  draggable: false,
  editable: false,
  eraser: "pixel",
  fill: "transparent",
  height: 1,
  origin: "top-left",
  points: points.length === 2 ? [points[0], points[1], points[0] + 0.1, points[1] + 0.1] : points,
  stroke: "#000000",
  strokeCap: "round",
  strokeWidth,
  width: 1,
  x: 0,
  y: 0,
});

/**
 * 创建一个 Leafer eraser Line。
 *
 * 实时拖动预览和根据 store.eraserPaths 重建持久擦除层都走这个方法，
 * 这样主画布里“正在擦”和“已经擦过”的视觉规则保持一致。
 */
const createLineEraserUI = (points: number[], strokeWidth: number) =>
  new Line(getLineEraserInput(points, strokeWidth));

/**
 * 创建不可见 eraser 占位节点。
 *
 * 首次给 group 添加 eraser 子节点时，Leafer 可能需要初始化 eraser 合成流程。
 * 预先放一个不可见占位，可以避免用户第一次擦线时看到一帧灰底或普通描边。
 */
const createLineEraserPrimerUI = () =>
  new Line({
    ...getLineEraserInput([0, 0, 0.1, 0.1], 0),
    visible: 0,
  });

/**
 * 同步 line group 内部结构：原始笔迹在下，所有 eraser 轨迹在上。
 *
 * 这里是“单个 line group 内部重建”，不是重建整个画布：
 * 1. 原始 __lineContent 会复用，只 set 最新 points / 样式。
 * 2. eraserPaths 对应的 eraser 子节点会按 store 重新生成。
 * 3. 重建范围只限当前 line 的 eraser 子节点，不影响其它节点或媒体实例。
 */
const syncLineGroupContent = (ui: ManagedNodeUI, node: LineNode) => {
  const group = ui as LineGroupUI;

  if (!group.__lineContent) {
    group.__lineContent = new Line(getLineContentInput(node));
    group.add?.(group.__lineContent, 0);
  } else {
    group.__lineContent.set(getLineContentInput(node));
  }

  if (!group.__eraserPrimer) {
    group.__eraserPrimer = createLineEraserPrimerUI();
    group.add?.(group.__eraserPrimer);
  }

  // eraserPaths 变化时直接重建这一组 eraser 子节点，数量通常很少，逻辑更稳定。
  group.__eraserContent?.forEach((eraser) => {
    eraser.destroy();
  });
  group.__eraserContent = (node.eraserPaths ?? []).map((eraserPath) => {
    const eraser = createLineEraserUI(eraserPath.points, eraserPath.strokeWidth);

    group.add?.(eraser);

    return eraser;
  });
};

/**
 * 按节点类型创建对应的 Leafer UI 实例。
 *
 * 这个方法只在新增节点或 kind 变化时调用；同一个 nodeId 的 kind 不变时，
 * 后续会复用旧 UI 并调用 set() 增量更新，避免拖拽、编辑、图层变化导致整画布重建。
 */
const createNodeUI = (node: CanvasNode): ManagedNodeUI | null => {
  // group 是唯一可能继续承载子节点的业务节点，因此创建为 Leafer Group。
  if (node.kind === "group") {
    return new Group(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 椭圆族统一由 Leafer Ellipse 表达。
  if (node.kind === "ellipse") {
    return new Ellipse(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 文本节点由 Leafer Text 表达，并交给 @leafer-in/text-editor 做双击编辑。
  if (node.kind === "text") {
    return new Text(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 自由线条和普通线条用 Group 表达：原线条 + 同组 eraser 轨迹。
  if (node.kind === "line") {
    const group = new Group(getNodeUIInput(node)) as ManagedNodeUI;

    syncLineGroupContent(group, node);

    return group;
  }

  // 三角形和多边形都由 Leafer Polygon 表达。
  if (node.kind === "polygon") {
    return new Polygon(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 星形节点由 Leafer Star 表达。
  if (node.kind === "star") {
    return new Star(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 当前剩余节点只可能是 rect。
  return new Rect(getNodeUIInput(node)) as ManagedNodeUI;
};

/**
 * 从 Leafer UI 反向读取可写回 store 的变换 patch。
 *
 * Leafer 拖拽和编辑会先改变运行时 UI 实例，store 不会自动更新。
 * 拖拽结束或编辑完成后用这个方法提取 x / y / width / height / rotation 等字段，
 * 再交给 canvasStore 形成一次可撤销的业务更新。
 */
const getNodePatchFromUI = (ui: IUI, node: CanvasNode) => {
  // 文本节点尺寸由文本内容和字体决定，这里只同步位置和旋转。
  if (node.kind === "text") {
    return {
      rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
      x: Math.round(ui.x ?? node.x),
      y: Math.round(ui.y ?? node.y),
    };
  }

  // 普通图形需要同步位置、尺寸和旋转；Math.round 避免拖拽产生长小数污染 store。
  const patch = {
    height: Math.round(ui.height ?? node.height),
    rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
    width: Math.round(ui.width ?? node.width),
    x: Math.round(ui.x ?? node.x),
    y: Math.round(ui.y ?? node.y),
  };

  // 线条编辑可能改动局部 points，需要额外同步一份数组。
  if (node.kind === "line") {
    const lineUI = ui as IUI & { points?: number[] };

    if (lineUI.points?.length) {
      return {
        ...patch,
        points: [...lineUI.points],
      };
    }
  }

  return patch;
};

/**
 * 判断本次 UI 反读是否真的改变了节点字段。
 *
 * Leafer 的 DragEvent.END 可能在没有实际变更时触发；如果 patch 和 store 完全一致，
 * 就跳过提交，避免撤销历史里出现用户感知不到的空操作。
 */
const hasNodePatchChange = (node: CanvasNode, patch: Partial<CanvasNode>) =>
  Object.entries(patch).some(
    ([key, value]) => (node as unknown as Record<string, unknown>)[key] !== value,
  );

/**
 * 计算两个业务坐标点之间的欧氏距离。
 *
 * 画笔拖动时会用它做采样节流，距离太近的点不写入 points，
 * 从而减少路径点数量和 Leafer 重绘压力。
 */
const getPointDistance = (left: CanvasPoint, right: CanvasPoint) =>
  Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2);

/**
 * 计算一个点到线段的最短距离。
 *
 * 橡皮擦擦线条时不能只看 line 的外接矩形，否则会擦到没有经过的空白区域。
 * 这里把鼠标点投影到每一段路径上，用真实路径距离判断是否命中。
 */
const getPointToSegmentDistance = (point: CanvasPoint, start: CanvasPoint, end: CanvasPoint) => {
  // 线段退化成一个点时，直接按点到点距离处理。
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx ** 2 + dy ** 2;

  if (lengthSquared === 0) return getPointDistance(point, start);

  // ratio 是点在线段方向上的投影比例，夹在 0~1 内表示最近点在线段上。
  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  // projection 是 point 在线段上的最近投影点。
  const projection = {
    x: start.x + ratio * dx,
    y: start.y + ratio * dy,
  };

  return getPointDistance(point, projection);
};

/**
 * 判断橡皮擦圆形范围是否碰到普通节点包围盒。
 *
 * 这个方法用于 rect / ellipse / polygon / text 等非 line 节点。
 * 普通节点当前仍然是“整节点擦除”，所以命中包围盒后会临时 destroy UI，
 * 松手时再把节点 id 提交给 store 删除。
 */
const isPointInNodeBounds = (
  node: CanvasNode,
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint,
) => {
  // 文本没有显式 width / height，按字号和文本长度估一个可擦除包围盒。
  const width = "width" in node ? node.width : Math.max(node.text.length * node.fontSize, 1);
  const height = "height" in node ? node.height : node.fontSize;
  const left = node.x + offset.x - radius;
  const top = node.y + offset.y - radius;
  const right = node.x + offset.x + width + radius;
  const bottom = node.y + offset.y + height + radius;

  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
};

/**
 * 判断橡皮擦是否擦到一条 line 节点的真实路径。
 *
 * line 节点要实现“经过哪里擦哪里”，所以这里按 points 拆成多段线段检测。
 * 命中容差 = 橡皮擦半径 + 线条半宽，符合视觉上两条描边相交就算擦到的直觉。
 */
const isPointNearLineNode = (
  node: Extract<CanvasNode, { kind: "line" }>,
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint,
) => {
  // 没有自定义 points 时，按从 (0,0) 到 (width,0) 的普通线条处理。
  const points = node.points?.length ? node.points : [0, 0, node.width, 0];
  // 线条命中半径 = 橡皮擦半径 + 线条半宽。
  const tolerance = radius + Math.max(node.strokeWidth ?? 0, 1) / 2;

  // points 按 x/y 成对排列，所以每次取相邻两个点构成一段。
  for (let index = 0; index < points.length - 2; index += 2) {
    const start = {
      x: node.x + offset.x + (points[index] ?? 0),
      y: node.y + offset.y + (points[index + 1] ?? 0),
    };
    const end = {
      x: node.x + offset.x + (points[index + 2] ?? 0),
      y: node.y + offset.y + (points[index + 3] ?? 0),
    };

    if (getPointToSegmentDistance(point, start, end) <= tolerance) return true;
  }

  return false;
};

/**
 * 从指定图层列表里找出橡皮擦当前命中的最上层节点。
 *
 * rootIds / childrenIds 的后一个节点视觉上更靠上，所以这里从后往前遍历。
 * group 本身只作为层级容器，不直接被擦除；命中检测会递归进入它的 childrenIds，
 * 并通过 offset 累加父级位移，把组内局部节点换算到画板全局坐标。
 */
const findHitNode = (
  page: CanvasPage,
  ids: string[],
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint = { x: 0, y: 0 },
): HitNodeResult | undefined => {
  // 从后往前找，保证视觉上更靠上的节点优先被橡皮擦命中。
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    const node = page.nodeMap[ids[index]];

    if (!node) continue;

    // group 只是层级容器，实际命中继续递归到它的子节点。
    if (node.kind === "group") {
      const childHit = findHitNode(page, node.childrenIds, point, radius, {
        x: offset.x + node.x,
        y: offset.y + node.y,
      });

      if (childHit) return childHit;
    }

    // 线条要按路径距离命中，不能只看外接矩形。
    if (node.kind === "line") {
      if (isPointNearLineNode(node, point, radius, offset)) return { id: node.id, offset };
      continue;
    }

    // 其它图形用包围盒命中，满足橡皮擦基础交互即可。
    if (isPointInNodeBounds(node, point, radius, offset)) return { id: node.id, offset };
  }

  return undefined;
};

/**
 * 把画板全局坐标转换成某条 line 节点内部坐标。
 *
 * eraserPaths 存在 LineNode 上，points 必须是相对 line 自身左上角的局部坐标。
 * parentOffset 用来扣掉 group 嵌套带来的父级位移。
 */
const getLineLocalPoint = (node: LineNode, point: CanvasPoint, parentOffset: CanvasPoint) => ({
  x: point.x - parentOffset.x - node.x,
  y: point.y - parentOffset.y - node.y,
});

/**
 * 用实时预览状态把全局鼠标点转换成 line 内部坐标。
 *
 * preview 已经缓存了 nodeX / nodeY / parentOffset，pointermove 时不必再次查 store。
 * 这样实时擦除只更新临时 Line 的 points，避免频繁读写业务状态。
 */
const getPreviewLocalPoint = (preview: LineEraserPreview, point: CanvasPoint) => ({
  x: point.x - preview.parentOffset.x - preview.nodeX,
  y: point.y - preview.parentOffset.y - preview.nodeY,
});

/**
 * 把 brush 采样到的全局画板点归一化成一个 LineNode 输入。
 *
 * 画笔拖动时记录的是画板全局坐标；真正入 store 时需要转成：
 * 1. node.x / node.y = 所有点的外接矩形左上角。
 * 2. node.width / node.height = 外接矩形尺寸。
 * 3. node.points = 相对 node.x / node.y 的局部点。
 *
 * 这样后续拖拽整条线时只改 node.x / node.y，不需要重写每一个 points。
 */
const getNormalizedLineNodeInput = (
  points: number[],
  strokeWidth: number,
): Omit<LineNode, "id" | "name"> | undefined => {
  // 少于一个点对时不能形成线。
  if (points.length < 2) return undefined;

  // 只有一个采样点时补一个极短线段，让 Leafer 能正常渲染。
  if (points.length === 2) {
    points.push(points[0] + 0.1, points[1] + 0.1);
  }

  // 计算采样点外接矩形，把全局点转换成 line 节点内部局部 points。
  const xValues = points.filter((_, index) => index % 2 === 0);
  const yValues = points.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);
  const localPoints = points.map((value, index) => (index % 2 === 0 ? value - minX : value - minY));

  // line 节点的 x/y 是外接矩形左上角，points 是相对这个左上角的局部坐标。
  return {
    animationList: [],
    curve: 0.2,
    fill: "transparent",
    height: Math.max(maxY - minY, 1),
    kind: "line",
    points: localPoints,
    rotation: 0,
    stroke: "#111827",
    strokeCap: "round",
    strokeStyle: "solid",
    strokeWidth,
    transformOrigin: "top-left",
    width: Math.max(maxX - minX, 1),
    x: minX,
    y: minY,
  };
};

/**
 * 把当前页面数据同步到 Leafer 画布，并把 Leafer 交互结果写回 React store。
 *
 * 这个 hook 负责四件事：
 * 1. 初始化 LeaferApp / Editor，并在卸载时销毁。
 * 2. 按 viewport / viewSize 维护稳定的 stage 和 board。
 * 3. 按 nodeMap / rootIds 增量同步节点 UI，而不是整画布重建。
 * 4. 接管 brush / eraser pointer 手势，select 模式则交给 Leafer Editor。
 */
export function useLeaferCanvas({
  onAddDrawLine,
  onApplyEraserResult,
  onSelectNode,
  onSelectNodes,
  onUpdateNode,
  onUpdateNodes,
  page,
  tool,
  viewRef,
  viewSize,
}: UseLeaferCanvasOptions) {
  // LeaferApp 生命周期只和 DOM 容器绑定，不能随着 React state 每次变化重建。
  const appRef = useRef<EditableLeaferApp | null>(null);
  // board 是业务画板根容器，所有业务节点都挂在它或它的 group 子节点下面。
  const boardRef = useRef<Frame | null>(null);
  // brush / eraser 拖动过程中跨 pointermove / pointerup 共享的临时状态。
  const drawingRef = useRef<ToolDrawingState | null>(null);
  // 标记当前 EditorEvent.SELECT 是否由代码主动 select/cancel 触发，避免循环写 store。
  const isSyncingEditorSelectionRef = useRef(false);
  // 以下 callback ref 解决 Leafer 事件监听只注册一次，但回调需要永远拿到最新 store action 的问题。
  const onAddDrawLineRef = useRef(onAddDrawLine);
  const onApplyEraserResultRef = useRef(onApplyEraserResult);
  const onSelectNodeRef = useRef(onSelectNode);
  // pageRef 给非 React 事件读取最新页面数据，避免事件闭包捕获旧 nodeMap。
  const pageRef = useRef(page);
  const onSelectNodesRef = useRef(onSelectNodes);
  const onUpdateNodeRef = useRef(onUpdateNode);
  const onUpdateNodesRef = useRef(onUpdateNodes);
  // stage 是缩放和居中容器，board 是 1920 x 1080 白色画板。
  const stageRef = useRef<Group | null>(null);
  // toolRef 让 pointermove / pointerup 读取最新工具模式和笔刷尺寸。
  const toolRef = useRef(tool);
  // 增量同步索引：业务节点 id -> Leafer UI / 节点类型 / 当前父容器。
  const uiKindMapRef = useRef(new Map<string, CanvasNode["kind"]>());
  const uiMapRef = useRef(new Map<string, ManagedNodeUI>());
  const uiParentMapRef = useRef(new Map<string, ParentNodeUI>());
  const { nodeMap, rootIds, selectedIds, viewport } = page;

  /** 把 React 最新 props 同步到 ref，供 Leafer 原生事件回调读取。 */
  useEffect(() => {
    onAddDrawLineRef.current = onAddDrawLine;
    onApplyEraserResultRef.current = onApplyEraserResult;
    onSelectNodeRef.current = onSelectNode;
    pageRef.current = page;
    onSelectNodesRef.current = onSelectNodes;
    onUpdateNodeRef.current = onUpdateNode;
    onUpdateNodesRef.current = onUpdateNodes;
    toolRef.current = tool;
  }, [
    onAddDrawLine,
    onApplyEraserResult,
    onSelectNode,
    onSelectNodes,
    onUpdateNode,
    onUpdateNodes,
    page,
    tool,
  ]);

  /** 创建 LeaferApp，并注册只需要绑定一次的 Leafer / Editor 事件。 */
  useEffect(() => {
    // DOM 容器还没挂载时不能创建 LeaferApp。
    if (!viewRef.current) return undefined;

    // cleanup 需要清理的是当前 effect 创建时对应的这些 Map，不依赖之后 ref.current 的变化。
    const uiMap = uiMapRef.current;
    const uiKindMap = uiKindMapRef.current;
    const uiParentMap = uiParentMapRef.current;
    const app = new LeaferApp({
      // editor: {} 会让 @leafer-in/editor 插件初始化编辑器。
      editor: {},
      // App 底色是工作区灰色，白色画板由 board Frame 负责。
      fill: "#eef1f6",
      // Leafer 挂载到 Home 里的 .canvas-maker__canvas div。
      view: viewRef.current,
    }) as EditableLeaferApp;

    // 保存 app 实例，后续 effect 通过它增量同步 stage、节点和选区。
    appRef.current = app;
    /**
     * 根据 Leafer UI 反查业务节点 id。
     *
     * EditorEvent.SELECT 给的是 UI 实例，不知道业务 id。
     * uiMap 是本 hook 托管的 nodeId -> UI 索引，所以这里反向遍历得到 store 里的 id。
     */
    const getIdByUI = (target: IUI) => [...uiMap.entries()].find(([, ui]) => ui === target)?.[0];

    /**
     * 根据当前 Leafer UI 状态生成单个节点的更新描述。
     *
     * 拖拽结束时，Leafer UI 已经被移动，但 pageRef.current 还是 store 中的旧值。
     * 这个方法读取 UI 上的最新变换，和旧节点比较后，只在真的变化时返回 update。
     */
    const getNodeUpdate = (id: string): CanvasNodeUpdate | undefined => {
      const ui = uiMap.get(id);
      const node = pageRef.current.nodeMap[id];

      if (!ui || !node) return undefined;

      // Leafer 拖拽后，最新位置在 UI 实例上；store 里的 node 还是拖拽前的数据。
      const data = getNodePatchFromUI(ui, node);

      // 坐标没有变化就不提交，避免空操作进入撤销历史。
      return hasNodePatchChange(node, data) ? { data, id } : undefined;
    };
    /**
     * 把当前选中节点在 Leafer 中的最新变换批量写回 store。
     *
     * 多选拖拽时 Leafer 会同时修改多个 UI 的 x/y。
     * 这里收集所有真正变化的节点，一次性提交，保证撤销历史和缩略图更新都是一组操作。
     */
    const syncSelectedNodeTransforms = () => {
      // DragEvent.END 在 app 捕获阶段触发；这里只同步当前选区里真正移动过的节点。
      const selectedIds = pageRef.current.selectedIds;
      // 多选拖拽时，选区里的每个元素都可能被 Leafer 改了 x/y。
      // 这里统一收集后批量提交，让缩略图和切页重建都读到新位置。
      const updates = selectedIds
        .map((id) => getNodeUpdate(id))
        .filter((update): update is CanvasNodeUpdate => Boolean(update));

      onUpdateNodesRef.current(updates);
    };
    /**
     * 把 Leafer Editor 的选择结果同步回 store。
     *
     * 用户点击、框选、取消选择都会触发 EditorEvent.SELECT。
     * 代码主动调用 editor.select/cancel 也可能触发同一事件，所以需要用
     * isSyncingEditorSelectionRef 区分“用户选择”和“程序同步选择”。
     */
    const syncEditorSelection = (event: EditorSelectEvent) => {
      // 代码主动调用 editor.select/cancel 时也可能触发 SELECT，不能再写回 store。
      if (isSyncingEditorSelectionRef.current) return;

      // list 是常规来源，value 是兼容某些 Leafer 事件形态的兜底来源。
      const list =
        event.list ?? (Array.isArray(event.value) ? event.value : event.value ? [event.value] : []);
      const ids = list.map((item) => getIdByUI(item)).filter((id): id is string => Boolean(id));

      // 用户点击或框选产生的选择结果写回 store。
      onSelectNodesRef.current(ids);
    };

    // 框选、单选和取消选择都会通过这个事件同步回 store。
    app.editor?.on(EditorEvent.SELECT, syncEditorSelection);
    // 拖动结束统一检查选中节点位置，capture=true 让它能覆盖多选拖拽场景。
    (app as LeaferEventTarget).on?.(DragEvent.END, syncSelectedNodeTransforms, undefined, true);
    // 文本编辑完成后，把 Leafer 内部编辑器里的最终文本写回业务节点。
    app.editor?.on(InnerEditorEvent.CLOSE, (event: InnerEditorCloseEvent) => {
      const matched = [...uiMap.entries()].find(([, ui]) => ui === event.editTarget);

      if (!matched || event.editTarget?.text === undefined) return;

      onUpdateNode(matched[0], { text: String(event.editTarget.text) });
    });

    // 组件卸载或 viewRef 变化时销毁整个 LeaferApp 和所有托管索引。
    return () => {
      app.destroy();
      appRef.current = null;
      boardRef.current = null;
      stageRef.current = null;
      uiKindMap.clear();
      uiMap.clear();
      uiParentMap.clear();
    };
  }, [onUpdateNode, viewRef]);

  /** brush / eraser 的自定义 pointer 交互；select 模式完全交给 Leafer Editor。 */
  useEffect(() => {
    /**
     * 把浏览器 pointer 事件坐标换算成业务画板坐标。
     *
     * DOM 事件给的是 viewport 像素坐标；Leafer stage 会把 1920 x 1080 的业务画板
     * 等比缩放并居中到 canvas 容器内。这里反向扣掉 DOM 位置、居中偏移和缩放比例，
     * 得到后续 brush / eraser 都能直接使用的画板坐标。
     */
    const getCanvasPoint = (event: PointerEvent): CanvasPoint | undefined => {
      // DOM 坐标必须换算成 1920 x 1080 的业务画板坐标。
      const view = viewRef.current;
      const activePage = pageRef.current;

      // view 还没挂载时不处理指针。
      if (!view) return undefined;

      // rect 是当前 canvas DOM 在浏览器 viewport 中的位置和尺寸。
      const rect = view.getBoundingClientRect();
      // viewSize 由 Home 的 useSize 给出；没有时退回 DOM 实测尺寸。
      const viewWidth = viewSize?.width ?? rect.width;
      const viewHeight = viewSize?.height ?? rect.height;
      // stage 用同样的规则等比缩放业务画板，所以指针反算也必须一致。
      const scale = Math.min(
        viewWidth / activePage.viewport.width,
        viewHeight / activePage.viewport.height,
      );
      // boardX / boardY 是白色画板在 canvas 容器内部的居中偏移。
      const boardX = Math.max((viewWidth - activePage.viewport.width * scale) / 2, 0);
      const boardY = Math.max((viewHeight - activePage.viewport.height * scale) / 2, 0);
      const x = (event.clientX - rect.left - boardX) / scale;
      const y = (event.clientY - rect.top - boardY) / scale;

      // 指针落在白色画板外时，不启动画笔或橡皮擦。
      if (x < 0 || y < 0 || x > activePage.viewport.width || y > activePage.viewport.height) {
        return undefined;
      }

      return { x, y };
    };

    /**
     * 给某条 line 的实时 eraser 预览追加一个路径点。
     *
     * point 是画板全局坐标，临时 eraser Line 挂在 line group 内，所以要先转换成 line 局部坐标。
     * 转换后的 path 会同时驱动实时预览，并在 pointerup 时写入 store.eraserPaths。
     */
    const appendPointToLinePreview = (preview: LineEraserPreview, point: CanvasPoint) => {
      const localPoint = getPreviewLocalPoint(preview, point);
      const lastX = preview.path[preview.path.length - 2];
      const lastY = preview.path[preview.path.length - 1];

      // 同一个点不重复写入，减少 points 数量，也避免 Leafer 反复重绘同一条路径。
      if (lastX === localPoint.x && lastY === localPoint.y) return;

      preview.path.push(localPoint.x, localPoint.y);
      preview.tempLine.set(getLineEraserInput(preview.path, toolRef.current.eraserSize));
    };
    /**
     * 给本次手势已经命中过的所有 line 预览追加当前鼠标点。
     *
     * 一旦某条 line 被命中，它的 eraser 子线就跟随完整鼠标轨迹。
     * 这样鼠标短暂离开 line 的命中范围后再回来，擦除路径仍然连续，不会断成多个突兀片段。
     */
    const appendPointToActiveLinePreviews = (point: CanvasPoint) => {
      // 一旦某条 line 在本次手势中被命中过，它的 eraser 子线就应该跟随完整鼠标轨迹。
      drawingRef.current?.lineErasers.forEach((preview) => {
        appendPointToLinePreview(preview, point);
      });
    };
    /**
     * 更新某条 line 在当前 eraser 手势中的实时擦除预览。
     *
     * line 不会像普通图形那样整节点 destroy。
     * 第一次命中时，在 line group 内新建一个临时 eraser Line；
     * 后续持续命中时，只更新同一个临时 Line 的 points，由 Leafer 原生 eraser 实时渲染。
     */
    const updateLinePreview = (id: string, node: LineNode, parentOffset: CanvasPoint) => {
      // line 擦除不 destroy 原 UI，而是在 line group 里追加一个 Leafer 原生 eraser Line。
      const drawing = drawingRef.current;
      const lineGroup = uiMapRef.current.get(id) as LineGroupUI | undefined;
      const lastPoint = {
        x: drawing?.points[drawing.points.length - 2] ?? 0,
        y: drawing?.points[drawing.points.length - 1] ?? 0,
      };

      if (!drawing || !lineGroup) return;

      const localPoint = getLineLocalPoint(node, lastPoint, parentOffset);
      let preview = drawing.lineErasers.get(id);

      if (!preview) {
        // 第一次命中这条线时创建临时 eraser 子 Line，并从当前点开始记录局部路径。
        const path = [localPoint.x, localPoint.y];
        const tempLine = createLineEraserUI(path, toolRef.current.eraserSize);

        lineGroup.add?.(tempLine);
        preview = {
          nodeX: node.x,
          nodeY: node.y,
          parentOffset,
          path,
          tempLine,
        };
        drawing.lineErasers.set(id, preview);
        return;
      }

      // 同一条 line 上持续拖动时，只更新同一个临时 eraser Line，实时预览由 Leafer 渲染器完成。
      appendPointToLinePreview(preview, lastPoint);
    };
    /**
     * 清理本次手势创建的临时 line eraser 预览。
     *
     * 临时 eraser Line 只负责拖动中的即时反馈。
     * pointerup 后会先销毁它们，再通过 store.eraserPaths 重建持久 eraser 子节点，
     * 避免同一条擦除路径显示两遍。
     */
    const cleanupLineEraserPreviews = (drawing: ToolDrawingState) => {
      // 临时 eraser Line 只用于本次拖动预览；松手后会由 store.eraserPaths 重建为持久子节点。
      drawing.lineErasers.forEach((preview) => {
        preview.tempLine.destroy();
      });
      drawing.lineErasers.clear();
    };
    /**
     * 把本次手势中的 line eraser 预览转换成 store 更新数据。
     *
     * 返回的 points 已经是 line 内部局部坐标，主画布和缩略图 worker 都会按同一规则重建。
     * 这里不直接写 store，只生成 onApplyEraserResult 需要的一次性提交数据。
     */
    const getLineEraserUpdates = (drawing: ToolDrawingState): CanvasLineEraserUpdate[] =>
      [...drawing.lineErasers.entries()]
        .map(([id, preview]) => ({
          id,
          points: [...preview.path],
          strokeWidth: toolRef.current.eraserSize,
        }))
        .filter((update) => update.points.length >= 2);

    /**
     * 在指定画板坐标执行一次橡皮擦命中和擦除。
     *
     * 普通节点：命中后先临时 destroy UI，让用户立刻看到消失效果，松手再从 store 删除。
     * line 节点：不删除整条线，只更新 line group 内的 eraser 预览路径，实现局部擦除。
     */
    const eraseAtPoint = (point: CanvasPoint) => {
      // 没有正在进行的 eraser 手势时，不做删除。
      const drawing = drawingRef.current;

      if (!drawing) return;

      // 从当前页面根节点开始命中检测，内部会递归 group。
      const hit = findHitNode(
        pageRef.current,
        pageRef.current.rootIds,
        point,
        toolRef.current.eraserSize / 2,
      );
      const node = hit ? pageRef.current.nodeMap[hit.id] : undefined;

      // 没命中时，本次 move 不擦除任何东西。
      if (!hit || !node) return;

      if (node.kind === "line") {
        // 线条命中后只更新 eraser 预览，不加入 erasedIds，因为它不会整条删除。
        updateLinePreview(hit.id, node, hit.offset);
        return;
      }

      // 普通节点仍然是整节点擦除，同一手势命中过一次后不重复处理。
      if (drawing.erasedIds.has(hit.id)) return;

      // 先从 Leafer UI 上临时销毁，让用户立刻看到擦除效果；松手后再提交到 store。
      drawing.erasedIds.add(hit.id);
      uiMapRef.current.get(hit.id)?.destroy();
      uiMapRef.current.delete(hit.id);
      uiKindMapRef.current.delete(hit.id);
      uiParentMapRef.current.delete(hit.id);
    };

    /**
     * 处理 brush / eraser 的 pointerdown。
     *
     * select 模式不进入这里的自定义流程，事件继续交给 Leafer Editor。
     * brush / eraser 模式会接管本次手势、清空当前选区，并把 move/up 监听挂到 window，
     * 确保鼠标拖出画布后仍能正常结束本次绘制或擦除。
     */
    const handlePointerDown = (event: PointerEvent) => {
      // select 模式下不拦截 pointer，让 Leafer Editor 负责点击、拖拽和框选。
      const activeTool = toolRef.current;

      if (activeTool.mode === "select") return;

      // brush / eraser 只在白色业务画板内开始。
      const point = getCanvasPoint(event);

      if (!point) return;

      // 自定义工具接管本次手势，阻止 Leafer Editor 同时选中或拖拽节点。
      event.preventDefault();
      event.stopPropagation();
      onSelectNodeRef.current(undefined);

      // 记录本次手势的 pointerId 和起点，后续 move/up 只响应同一个 pointer。
      const drawing: ToolDrawingState = {
        erasedIds: new Set(),
        lineErasers: new Map(),
        pointerId: event.pointerId,
        points: [point.x, point.y],
      };

      drawingRef.current = drawing;

      if (activeTool.mode === "brush") {
        // brush 拖动过程中先画一条临时 Line，避免每个 move 都写 store。
        const tempLine = new Line({
          curve: 0.2,
          editable: false,
          fill: "transparent",
          points: [...drawing.points],
          stroke: "#111827",
          strokeCap: "round",
          strokeWidth: activeTool.brushSize,
          x: 0,
          y: 0,
        });

        boardRef.current?.add(tempLine);
        drawing.tempLine = tempLine;
      } else {
        // eraser 按下时立即尝试擦除起点下方节点。
        eraseAtPoint(point);
      }

      // move/up 监听挂到 window，保证指针拖出画布后仍能完成本次手势。
      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
    };

    /**
     * 处理 brush / eraser 的 pointermove。
     *
     * brush：按最小距离采样，更新临时 Line 的 points，不频繁写 store。
     * eraser：每次移动都尝试擦除当前位置，并给已命中的 line 追加 eraser 路径点。
     */
    const handlePointerMove = (event: PointerEvent) => {
      // 只处理当前手势对应的 pointer。
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      // 移动到画板外时，本次 move 不产生新点或擦除。
      const point = getCanvasPoint(event);

      if (!point) return;

      // 自定义工具持续接管事件。
      event.preventDefault();
      event.stopPropagation();

      if (toolRef.current.mode === "brush") {
        // 采样点距离太近时跳过，减少 points 数量和渲染压力。
        const lastY = drawing.points[drawing.points.length - 1] ?? point.y;
        const lastX = drawing.points[drawing.points.length - 2] ?? point.x;

        if (getPointDistance({ x: lastX, y: lastY }, point) < 2) return;

        // 追加采样点，并更新临时线条的 points。
        drawing.points.push(point.x, point.y);

        if (drawing.tempLine) {
          drawing.tempLine.points = [...drawing.points];
        }
        return;
      }

      // eraser 模式每次 move 都尝试擦除当前位置命中的节点。
      // 已命中的 line 也会继续追加路径点，实现“橡皮擦经过哪里就擦哪里”的实时效果。
      drawing.points.push(point.x, point.y);
      appendPointToActiveLinePreviews(point);
      eraseAtPoint(point);
    };

    /**
     * 处理 brush / eraser 的 pointerup。
     *
     * brush：销毁临时 Line，把采样点归一化成 LineNode，并提交一次 addDrawLine。
     * eraser：销毁临时 eraser 预览，把普通节点删除列表和 line eraserPaths 作为一次历史提交。
     */
    const handlePointerUp = (event: PointerEvent) => {
      // 非当前 pointer 的 up 不结束手势。
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      // 松手后移除全局监听，避免后续普通鼠标移动继续进入工具逻辑。
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);

      if (toolRef.current.mode === "brush") {
        // 临时线只用于即时反馈，最终会转换成 store 中的 LineNode。
        drawing.tempLine?.destroy();

        // 归一化采样点，生成一条业务 LineNode。
        const lineInput = getNormalizedLineNodeInput(drawing.points, toolRef.current.brushSize);

        if (lineInput) {
          // 只在松手时提交一次历史记录。
          onAddDrawLineRef.current(lineInput);
        }
      } else {
        const lineErasers = getLineEraserUpdates(drawing);

        // 临时 eraser Line 先清掉，随后 store 更新会按 eraserPaths 重建持久 eraser 子节点。
        cleanupLineEraserPreviews(drawing);
        // eraser 也是松手时把普通节点删除和 line eraser 轨迹作为一次历史记录提交。
        onApplyEraserResultRef.current([...drawing.erasedIds], lineErasers);
      }

      // 清空手势状态，等待下一次 pointerdown。
      drawingRef.current = null;
    };

    // 只在 canvas 容器上监听 pointerdown；后续 move/up 由手势开始时动态绑定。
    const view = viewRef.current;

    if (!view) return undefined;

    view.addEventListener("pointerdown", handlePointerDown, true);

    // effect 依赖变化或组件卸载时，移除可能残留的监听。
    return () => {
      view.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [viewRef, viewSize?.height, viewSize?.width]);

  /** 同步稳定容器尺寸：只创建一次 stage / board，后续 resize 只 set 属性。 */
  useEffect(() => {
    const app = appRef.current;

    // LeaferApp 还没初始化时，等初始化 effect 完成后再同步容器。
    if (!app) return;

    // stage / board 是稳定容器：尺寸变化只更新缩放和白板尺寸，不重建节点 UI。
    const viewWidth = viewSize?.width ?? viewRef.current?.clientWidth ?? viewport.width;
    const viewHeight = viewSize?.height ?? viewRef.current?.clientHeight ?? viewport.height;
    const scale = Math.min(viewWidth / viewport.width, viewHeight / viewport.height);
    const stageInput = {
      // stage 缩放把 1920 x 1080 业务坐标映射到当前 DOM 像素尺寸。
      scale,
      // x/y 负责把缩放后的白色画板在 canvas 容器中居中。
      x: Math.max((viewWidth - viewport.width * scale) / 2, 0),
      y: Math.max((viewHeight - viewport.height * scale) / 2, 0),
    };
    const boardInput = {
      // board 不参与编辑，只作为白色画板和节点父容器。
      editable: false,
      fill: "#ffffff",
      height: viewport.height,
      overflow: "hide" as const,
      stroke: "#d9dee8",
      width: viewport.width,
      x: 0,
      y: 0,
    };

    if (!stageRef.current || !boardRef.current) {
      // 首次进入时创建稳定容器，并挂到 Leafer app.tree；之后不再清空 app.tree。
      const stage = new Group(stageInput);
      const board = new Frame(boardInput);

      boardRef.current = board;
      stageRef.current = stage;
      stage.add(board);
      app.tree.add(stage);
      return;
    }

    // 尺寸变化只更新容器属性，保留所有节点 UI 实例和媒体加载状态。
    stageRef.current.set(stageInput);
    boardRef.current.set(boardInput);
  }, [viewport.height, viewport.width, viewRef, viewSize?.height, viewSize?.width]);

  /** 将 nodeMap/rootIds 增量同步到 Leafer UI 树。 */
  useEffect(() => {
    // board 是业务节点的根父容器；还未创建时跳过，等待 stage effect 首次创建。
    const board = boardRef.current as ParentNodeUI | null;

    if (!board) return;

    const uiMap = uiMapRef.current;
    const uiKindMap = uiKindMapRef.current;
    const uiParentMap = uiParentMapRef.current;
    // reachableIds 记录本轮从 rootIds / childrenIds 能访问到的节点，最后用于删除 stale UI。
    const reachableIds = new Set<string>();
    /**
     * 在删除或替换 UI 前取消 Leafer Editor 当前选区。
     *
     * Editor 内部会持有被选中的 UI 引用；如果先 destroy UI 再取消选区，
     * 后续 editor.select/cancel 可能继续访问已销毁对象，导致选择框异常或元素消失。
     */
    const cancelEditorSelection = () => {
      // 删除或替换 UI 前先取消 Editor 选择，避免 Leafer 继续持有已销毁对象。
      isSyncingEditorSelectionRef.current = true;
      appRef.current?.editor?.cancel();
      isSyncingEditorSelectionRef.current = false;
    };
    /**
     * 删除本 hook 托管的单个 Leafer UI，并同步清理索引。
     *
     * 这个方法只处理指定 nodeId，不清空 app.tree。
     * 它用于 store 删除节点、节点不可达、或同一 id 的 kind 变化需要替换 UI 的场景。
     */
    const removeManagedUI = (id: string) => {
      // 删除节点、kind 变化替换节点时走这里，只销毁指定 nodeId 对应的 UI。
      const ui = uiMap.get(id);

      if (!ui) return;

      cancelEditorSelection();
      // destroy 会让 UI 从当前父容器移除并释放 Leafer 内部资源。
      ui.destroy();
      // 三个索引必须同步清理，否则后续会误认为旧 UI 仍可复用。
      uiMap.delete(id);
      uiKindMap.delete(id);
      uiParentMap.delete(id);
    };
    /**
     * 给新创建的节点 UI 绑定一次交互事件。
     *
     * 事件闭包只捕获稳定的 nodeId；真正需要节点数据时从 pageRef 读取最新 store 快照。
     * 这样 UI 后续 set() 更新时不会重复绑定事件，也不会因为闭包捕获旧 nodeMap 写回旧坐标。
     */
    const bindNodeUIEvents = (nodeId: string, ui: ManagedNodeUI) => {
      // 事件闭包只捕获 nodeId；拖拽结束时从 pageRef 取最新节点，避免用旧坐标生成 patch。
      ui.on("tap", (event: PointerLikeEvent) => {
        // 点击单个 UI 时直接写 store；additive 由 Ctrl/Shift 等修饰键决定。
        onSelectNodeRef.current(nodeId, isAdditiveSelect(event));
      });
      ui.on(DragEvent.END, () => {
        // 拖拽结束后，Leafer UI 上有最新变换；store 需要在这里落盘。
        const latestNode = pageRef.current.nodeMap[nodeId];

        // 节点可能在拖拽过程中被删除，兜底跳过。
        if (!latestNode) return;

        onUpdateNodeRef.current(nodeId, getNodePatchFromUI(ui, latestNode));
      });
    };
    /**
     * 把一个业务节点同步到指定 Leafer 父容器的指定图层位置。
     *
     * 这是节点增量同步的核心递归方法：
     * 1. 新节点只创建自己的 UI。
     * 2. 已有节点只 set 最新属性。
     * 3. kind 变化只替换这个节点自己的 UI。
     * 4. 父级变化或顺序变化只移动 UI 实例，不销毁重建。
     * 5. group 节点继续递归同步 childrenIds。
     */
    const syncNodeToParent = (nodeId: string, parent: ParentNodeUI, index: number) => {
      // nodeMap 是本轮同步的真实数据源。
      const node = nodeMap[nodeId];

      // rootIds / childrenIds 里出现不存在的 id 时跳过，避免脏数据让渲染崩溃。
      if (!node) return;

      // 只要本轮访问到，就认为这个 UI 仍应该存在。
      reachableIds.add(nodeId);

      // 先查是否已有可复用的 Leafer UI。
      let ui = uiMap.get(nodeId);

      if (ui && uiKindMap.get(nodeId) !== node.kind) {
        // Leafer 类由 kind 决定；kind 变化时只能替换这个节点自己的 UI。
        removeManagedUI(nodeId);
        ui = undefined;
      }

      if (!ui) {
        // 新增节点：只创建缺失 UI，不影响其它已存在节点和媒体实例。
        ui = createNodeUI(node) ?? undefined;

        if (!ui) return;

        // 新 UI 只绑定一次事件；后续 set 不会重复绑定。
        bindNodeUIEvents(nodeId, ui);
        // 建立 nodeId 到 UI / kind 的索引，供后续增量同步和事件反查。
        uiMap.set(nodeId, ui);
        uiKindMap.set(nodeId, node.kind);
      } else {
        // 普通属性变化：位置、尺寸、文本、样式都增量写入现有 UI。
        ui.set(getNodeUIInput(node));
      }

      if (node.kind === "line") {
        // line group 自身只负责位置和包围盒；内部原始线和 eraser 轨迹单独同步。
        syncLineGroupContent(ui, node);
      }

      // oldParent 用来判断 group/ungroup 是否让节点跨父容器移动。
      const oldParent = uiParentMap.get(nodeId);

      if (oldParent && oldParent !== parent) {
        // group / ungroup 会改变父容器；移动 UI 时保留实例，不销毁重建。
        oldParent.remove(ui, false);
      }

      if (!parent.children || parent.children[index] !== ui) {
        // 图层顺序由 rootIds / childrenIds 决定，这里只在目标位置不一致时重排。
        if (parent.children) {
          // Leafer remove(..., false) 表示从父容器摘下但不销毁 UI，用于排序和移动。
          parent.remove(ui, false);
        }
        // add(ui, index) 会把 UI 插到目标图层位置。
        parent.add(ui, index);
      }

      // 记录本轮同步后的父容器，供下一轮判断是否跨父级。
      uiParentMap.set(nodeId, parent);

      if (node.kind === "group") {
        // group 的 childrenIds 也按同样规则递归增量同步。
        node.childrenIds.forEach((childId, childIndex) => {
          syncNodeToParent(childId, ui as ParentNodeUI, childIndex);
        });
      }
    };

    // 根图层从 board 开始同步，rootIds 顺序就是根层级图层顺序。
    rootIds.forEach((nodeId, index) => {
      syncNodeToParent(nodeId, board, index);
    });

    // 本轮没有从 rootIds / childrenIds 访问到的 UI，说明已从 store 删除或断开层级。
    [...uiMap.keys()].forEach((nodeId) => {
      if (!reachableIds.has(nodeId)) {
        // store 中已经不可达的节点才销毁；其余节点都复用原 Leafer 实例。
        removeManagedUI(nodeId);
      }
    });
  }, [nodeMap, rootIds]);

  /** 根据当前工具模式切换 Leafer Editor 是否可以接管节点。 */
  useEffect(() => {
    const canUseEditor = tool.mode === "select";

    /**
     * brush / eraser 都是自定义 pointer 工具。
     * 如果节点仍保持 editable=true，Leafer Editor 即使没有选区，也会在 hover 时显示紫色可选框。
     * 因此非 select 模式下临时关闭托管 UI 的编辑和拖拽能力；自定义橡皮擦命中走 store 数据，不依赖 Leafer hit。
     */
    uiMapRef.current.forEach((ui) => {
      ui.set({
        draggable: canUseEditor,
        editable: canUseEditor,
      });
    });
  }, [nodeMap, rootIds, tool.mode]);

  /** 将 store.selectedIds 同步到 Leafer Editor 选择框。 */
  useEffect(() => {
    const app = appRef.current;

    // App 未初始化时不做选择同步。
    if (!app) return;

    // 运行时 Editor 有 list 字段，可用于避免重复 select 同一组 UI。
    const editor = app.editor as EditorSelectionHandle | undefined;
    // selectedIds 是业务 id，需要映射成当前仍存在的 Leafer UI。
    const selectedUIs = selectedIds
      .map((id) => uiMapRef.current.get(id))
      .filter((ui): ui is EditableNodeUI => Boolean(ui));
    // currentList 是 Leafer Editor 当前持有的选择 UI。
    const currentList = editor?.list ?? [];
    // 如果 Editor 里已经是同一组 UI，就不用再次调用 select。
    const isSameEditorSelection =
      currentList.length === selectedUIs.length &&
      currentList.every((ui, index) => ui === selectedUIs[index]);
    /**
     * 执行一次程序化 Editor 选区同步，并屏蔽由它引发的 SELECT 回写。
     *
     * store.selectedIds -> editor.select/cancel 是单向同步。
     * 这类同步不应该再触发 onSelectNodes 写回 store，否则会形成选择事件回环。
     */
    const syncEditorSelection = (select: () => void) => {
      // 程序化 select/cancel 也会触发 EditorEvent.SELECT，必须避免反向写回 store。
      isSyncingEditorSelectionRef.current = true;
      select();
      // Leafer 可能同步触发 SELECT，也可能微任务里触发；下一微任务再恢复用户事件处理。
      queueMicrotask(() => {
        isSyncingEditorSelectionRef.current = false;
      });
    };

    if (tool.mode !== "select") {
      // brush / eraser 模式不显示编辑框，避免工具操作时仍有选区控制点干扰。
      if (currentList.length > 0) {
        syncEditorSelection(() => {
          editor?.cancel();
        });
      }
      return;
    }

    if (selectedUIs.length > 0) {
      // 有选中节点时，让 Leafer Editor 显示对应控制框。
      if (!isSameEditorSelection) {
        syncEditorSelection(() => {
          editor?.select(selectedUIs);
        });
      }
      return;
    }

    // store 没有选区时，取消 Leafer Editor 当前选择。
    if (currentList.length > 0) {
      syncEditorSelection(() => {
        editor?.cancel();
      });
    }
  }, [nodeMap, rootIds, selectedIds, tool.mode]);
}
