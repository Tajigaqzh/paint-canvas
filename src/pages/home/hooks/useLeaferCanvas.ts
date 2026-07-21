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
  CanvasNode,
  CanvasNodeUpdate,
  CanvasPage,
  CanvasToolMode,
  EditableNodeUI,
  EditorHandle,
  LineNode,
} from "@/types";

type EditableLeaferApp = LeaferApp & {
  /** @leafer-in/editor 注册后挂到 App 上的编辑器实例。 */
  editor?: EditorHandle;
};

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

type UseLeaferCanvasOptions = {
  /** 当前工具配置；select 走 Leafer 编辑器，brush / eraser 走自定义指针事件。 */
  tool: {
    brushSize: number;
    eraserSize: number;
    mode: CanvasToolMode;
  };
  /** 当前页面，是渲染 Leafer 的唯一数据源。 */
  page: CanvasPage;
  /** 画笔松手后提交一条完整笔迹。 */
  onAddDrawLine: (line: Omit<LineNode, "id" | "name">) => void;
  /** 橡皮擦松手后批量删除命中的节点。 */
  onRemoveNodes: (ids: string[]) => void;
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

type LeaferEventTarget = {
  on?(type: string, listener: (event: unknown) => void, bind?: unknown, capture?: boolean): unknown;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type ToolDrawingState = {
  erasedIds: Set<string>;
  points: number[];
  pointerId: number;
  tempLine?: Line;
};

const getStrokeDashPattern = (node: CanvasNode) => {
  const width = Math.max(node.strokeWidth ?? 0, 0);

  if (width <= 0) return undefined;
  if (node.strokeStyle === "dashed") return [width * 4, width * 2];
  if (node.strokeStyle === "dotted") return [width, width * 2];

  return undefined;
};

const getNodePaintInput = (node: CanvasNode) => ({
  dashPattern: getStrokeDashPattern(node),
  fill: node.fill,
  stroke: node.stroke,
  strokeAlign: node.strokeAlign,
  strokeCap: node.strokeCap,
  strokeWidth: node.strokeWidth,
});

const isAdditiveSelect = (event: PointerLikeEvent) =>
  Boolean(
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.origin?.ctrlKey ||
    event.origin?.metaKey ||
    event.origin?.shiftKey,
  );

const createNodeUI = (node: CanvasNode): EditableNodeUI | null => {
  if (node.kind === "group") {
    return new Group({
      draggable: true,
      editable: true,
      ...getNodePaintInput(node),
      height: node.height,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      width: node.width,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  if (node.kind === "ellipse") {
    return new Ellipse({
      closed: node.closed,
      cornerRadius: node.cornerRadius,
      draggable: true,
      editable: true,
      endAngle: node.endAngle,
      ...getNodePaintInput(node),
      height: node.height,
      innerRadius: node.innerRadius,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      startAngle: node.startAngle,
      width: node.width,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  if (node.kind === "text") {
    return new Text({
      draggable: true,
      editable: true,
      ...getNodePaintInput(node),
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      text: node.text,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  if (node.kind === "line") {
    return new Line({
      cornerRadius: node.cornerRadius,
      curve: node.curve,
      draggable: true,
      editable: true,
      ...getNodePaintInput(node),
      height: node.height,
      origin: node.transformOrigin ?? "center",
      // Leafer 编辑线条时会原地修改 points，不能直接传入 store 里被冻结的数组。
      points: node.points ? [...node.points] : undefined,
      rotation: node.rotation ?? 0,
      width: node.width,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  if (node.kind === "polygon") {
    return new Polygon({
      cornerRadius: node.cornerRadius,
      draggable: true,
      editable: true,
      ...getNodePaintInput(node),
      height: node.height,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      sides: node.sides,
      width: node.width,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  if (node.kind === "star") {
    return new Star({
      cornerRadius: node.cornerRadius,
      corners: node.corners,
      draggable: true,
      editable: true,
      ...getNodePaintInput(node),
      height: node.height,
      innerRadius: node.innerRadius,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      startAngle: node.startAngle,
      width: node.width,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  return new Rect({
    cornerRadius: node.cornerRadius,
    draggable: true,
    editable: true,
    ...getNodePaintInput(node),
    height: node.height,
    origin: node.transformOrigin ?? "center",
    rotation: node.rotation ?? 0,
    width: node.width,
    x: node.x,
    y: node.y,
  }) as EditableNodeUI;
};

const getNodePatchFromUI = (ui: IUI, node: CanvasNode) => {
  if (node.kind === "text") {
    return {
      rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
      x: Math.round(ui.x ?? node.x),
      y: Math.round(ui.y ?? node.y),
    };
  }

  const patch = {
    height: Math.round(ui.height ?? node.height),
    rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
    width: Math.round(ui.width ?? node.width),
    x: Math.round(ui.x ?? node.x),
    y: Math.round(ui.y ?? node.y),
  };

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

const hasNodePatchChange = (node: CanvasNode, patch: Partial<CanvasNode>) =>
  Object.entries(patch).some(
    ([key, value]) => (node as unknown as Record<string, unknown>)[key] !== value,
  );

const getPointDistance = (left: CanvasPoint, right: CanvasPoint) =>
  Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2);

const getPointToSegmentDistance = (point: CanvasPoint, start: CanvasPoint, end: CanvasPoint) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx ** 2 + dy ** 2;

  if (lengthSquared === 0) return getPointDistance(point, start);

  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const projection = {
    x: start.x + ratio * dx,
    y: start.y + ratio * dy,
  };

  return getPointDistance(point, projection);
};

const isPointInNodeBounds = (
  node: CanvasNode,
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint,
) => {
  const width = "width" in node ? node.width : Math.max(node.text.length * node.fontSize, 1);
  const height = "height" in node ? node.height : node.fontSize;
  const left = node.x + offset.x - radius;
  const top = node.y + offset.y - radius;
  const right = node.x + offset.x + width + radius;
  const bottom = node.y + offset.y + height + radius;

  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
};

const isPointNearLineNode = (
  node: Extract<CanvasNode, { kind: "line" }>,
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint,
) => {
  const points = node.points?.length ? node.points : [0, 0, node.width, 0];
  const tolerance = radius + Math.max(node.strokeWidth ?? 0, 1) / 2;

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

const findHitNodeId = (
  page: CanvasPage,
  ids: string[],
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint = { x: 0, y: 0 },
): string | undefined => {
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    const node = page.nodeMap[ids[index]];

    if (!node) continue;

    if (node.kind === "group") {
      const childHitId = findHitNodeId(page, node.childrenIds, point, radius, {
        x: offset.x + node.x,
        y: offset.y + node.y,
      });

      if (childHitId) return childHitId;
    }

    if (node.kind === "line") {
      if (isPointNearLineNode(node, point, radius, offset)) return node.id;
      continue;
    }

    if (isPointInNodeBounds(node, point, radius, offset)) return node.id;
  }

  return undefined;
};

const getNormalizedLineNodeInput = (
  points: number[],
  strokeWidth: number,
): Omit<LineNode, "id" | "name"> | undefined => {
  if (points.length < 2) return undefined;

  if (points.length === 2) {
    points.push(points[0] + 0.1, points[1] + 0.1);
  }

  const xValues = points.filter((_, index) => index % 2 === 0);
  const yValues = points.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);
  const localPoints = points.map((value, index) => (index % 2 === 0 ? value - minX : value - minY));

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

export function useLeaferCanvas({
  onAddDrawLine,
  onRemoveNodes,
  onSelectNode,
  onSelectNodes,
  onUpdateNode,
  onUpdateNodes,
  page,
  tool,
  viewRef,
  viewSize,
}: UseLeaferCanvasOptions) {
  const appRef = useRef<EditableLeaferApp | null>(null);
  const boardRef = useRef<Frame | null>(null);
  const drawingRef = useRef<ToolDrawingState | null>(null);
  const onAddDrawLineRef = useRef(onAddDrawLine);
  const onRemoveNodesRef = useRef(onRemoveNodes);
  const onSelectNodeRef = useRef(onSelectNode);
  const pageRef = useRef(page);
  const onSelectNodesRef = useRef(onSelectNodes);
  const onUpdateNodesRef = useRef(onUpdateNodes);
  const toolRef = useRef(tool);
  const uiMapRef = useRef(new Map<string, EditableNodeUI>());
  const { nodeMap, rootIds, selectedIds, viewport } = page;

  useEffect(() => {
    onAddDrawLineRef.current = onAddDrawLine;
    onRemoveNodesRef.current = onRemoveNodes;
    onSelectNodeRef.current = onSelectNode;
    pageRef.current = page;
    onSelectNodesRef.current = onSelectNodes;
    onUpdateNodesRef.current = onUpdateNodes;
    toolRef.current = tool;
  }, [onAddDrawLine, onRemoveNodes, onSelectNode, onSelectNodes, onUpdateNodes, page, tool]);

  useEffect(() => {
    if (!viewRef.current) return undefined;

    const uiMap = uiMapRef.current;
    const app = new LeaferApp({
      editor: {},
      fill: "#eef1f6",
      view: viewRef.current,
    }) as EditableLeaferApp;

    appRef.current = app;
    const getIdByUI = (target: IUI) => [...uiMap.entries()].find(([, ui]) => ui === target)?.[0];
    const getNodeUpdate = (id: string): CanvasNodeUpdate | undefined => {
      const ui = uiMap.get(id);
      const node = pageRef.current.nodeMap[id];

      if (!ui || !node) return undefined;

      // Leafer 拖拽后，最新位置在 UI 实例上；store 里的 node 还是拖拽前的数据。
      const data = getNodePatchFromUI(ui, node);

      // 坐标没有变化就不提交，避免空操作进入撤销历史。
      return hasNodePatchChange(node, data) ? { data, id } : undefined;
    };
    const syncSelectedNodeTransforms = () => {
      const selectedIds = pageRef.current.selectedIds;
      // 多选拖拽时，选区里的每个元素都可能被 Leafer 改了 x/y。
      // 这里统一收集后批量提交，让缩略图和切页重建都读到新位置。
      const updates = selectedIds
        .map((id) => getNodeUpdate(id))
        .filter((update): update is CanvasNodeUpdate => Boolean(update));

      onUpdateNodesRef.current(updates);
    };
    const syncEditorSelection = (event: EditorSelectEvent) => {
      const list =
        event.list ?? (Array.isArray(event.value) ? event.value : event.value ? [event.value] : []);
      const ids = list.map((item) => getIdByUI(item)).filter((id): id is string => Boolean(id));

      onSelectNodesRef.current(ids);
    };

    app.editor?.on(EditorEvent.SELECT, syncEditorSelection);
    (app as LeaferEventTarget).on?.(DragEvent.END, syncSelectedNodeTransforms, undefined, true);
    app.editor?.on(InnerEditorEvent.CLOSE, (event: InnerEditorCloseEvent) => {
      const matched = [...uiMap.entries()].find(([, ui]) => ui === event.editTarget);

      if (!matched || event.editTarget?.text === undefined) return;

      onUpdateNode(matched[0], { text: String(event.editTarget.text) });
    });

    return () => {
      app.destroy();
      appRef.current = null;
      boardRef.current = null;
      uiMap.clear();
    };
  }, [onUpdateNode, viewRef]);

  useEffect(() => {
    const getCanvasPoint = (event: PointerEvent): CanvasPoint | undefined => {
      const view = viewRef.current;
      const activePage = pageRef.current;

      if (!view) return undefined;

      const rect = view.getBoundingClientRect();
      const viewWidth = viewSize?.width ?? rect.width;
      const viewHeight = viewSize?.height ?? rect.height;
      const scale = Math.min(
        viewWidth / activePage.viewport.width,
        viewHeight / activePage.viewport.height,
      );
      const boardX = Math.max((viewWidth - activePage.viewport.width * scale) / 2, 0);
      const boardY = Math.max((viewHeight - activePage.viewport.height * scale) / 2, 0);
      const x = (event.clientX - rect.left - boardX) / scale;
      const y = (event.clientY - rect.top - boardY) / scale;

      if (x < 0 || y < 0 || x > activePage.viewport.width || y > activePage.viewport.height) {
        return undefined;
      }

      return { x, y };
    };

    const eraseAtPoint = (point: CanvasPoint) => {
      const drawing = drawingRef.current;

      if (!drawing) return;

      const id = findHitNodeId(
        pageRef.current,
        pageRef.current.rootIds,
        point,
        toolRef.current.eraserSize / 2,
      );

      if (!id || drawing.erasedIds.has(id)) return;

      drawing.erasedIds.add(id);
      uiMapRef.current.get(id)?.destroy();
      uiMapRef.current.delete(id);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const activeTool = toolRef.current;

      if (activeTool.mode === "select") return;

      const point = getCanvasPoint(event);

      if (!point) return;

      event.preventDefault();
      event.stopPropagation();
      onSelectNodeRef.current(undefined);

      const drawing: ToolDrawingState = {
        erasedIds: new Set(),
        pointerId: event.pointerId,
        points: [point.x, point.y],
      };

      drawingRef.current = drawing;

      if (activeTool.mode === "brush") {
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
        eraseAtPoint(point);
      }

      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      const point = getCanvasPoint(event);

      if (!point) return;

      event.preventDefault();
      event.stopPropagation();

      if (toolRef.current.mode === "brush") {
        const lastY = drawing.points[drawing.points.length - 1] ?? point.y;
        const lastX = drawing.points[drawing.points.length - 2] ?? point.x;

        if (getPointDistance({ x: lastX, y: lastY }, point) < 2) return;

        drawing.points.push(point.x, point.y);

        if (drawing.tempLine) {
          drawing.tempLine.points = [...drawing.points];
        }
        return;
      }

      eraseAtPoint(point);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);

      if (toolRef.current.mode === "brush") {
        drawing.tempLine?.destroy();

        const lineInput = getNormalizedLineNodeInput(drawing.points, toolRef.current.brushSize);

        if (lineInput) {
          onAddDrawLineRef.current(lineInput);
        }
      } else {
        onRemoveNodesRef.current([...drawing.erasedIds]);
      }

      drawingRef.current = null;
    };

    const view = viewRef.current;

    if (!view) return undefined;

    view.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      view.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [viewRef, viewSize?.height, viewSize?.width]);

  useEffect(() => {
    const app = appRef.current;

    if (!app) return;

    uiMapRef.current.clear();
    app.tree.clear();

    const viewWidth = viewSize?.width ?? viewRef.current?.clientWidth ?? viewport.width;
    const viewHeight = viewSize?.height ?? viewRef.current?.clientHeight ?? viewport.height;
    const scale = Math.min(viewWidth / viewport.width, viewHeight / viewport.height);
    const stage = new Group({
      scale,
      x: Math.max((viewWidth - viewport.width * scale) / 2, 0),
      y: Math.max((viewHeight - viewport.height * scale) / 2, 0),
    });
    const board = new Frame({
      editable: false,
      fill: "#ffffff",
      height: viewport.height,
      overflow: "hide",
      stroke: "#d9dee8",
      width: viewport.width,
      x: 0,
      y: 0,
    });

    boardRef.current = board;
    stage.add(board);
    app.tree.add(stage);

    const addNodeToParent = (nodeId: string, parent: Group | Frame) => {
      const node = nodeMap[nodeId];

      if (!node) return;

      const ui = createNodeUI(node);

      if (!ui) return;

      ui.on("tap", (event: PointerLikeEvent) => {
        onSelectNode(node.id, isAdditiveSelect(event));
      });
      ui.on(DragEvent.END, () => {
        onUpdateNode(node.id, getNodePatchFromUI(ui, node));
      });
      parent.add(ui);
      uiMapRef.current.set(node.id, ui);

      if (node.kind === "group") {
        node.childrenIds.forEach((childId) => {
          addNodeToParent(childId, ui as Group);
        });
      }
    };

    rootIds.forEach((nodeId) => {
      addNodeToParent(nodeId, board);
    });
  }, [nodeMap, onSelectNode, onUpdateNode, rootIds, viewport, viewRef, viewSize]);

  useEffect(() => {
    const app = appRef.current;

    if (!app) return;

    const selectedUIs = selectedIds
      .map((id) => uiMapRef.current.get(id))
      .filter((ui): ui is EditableNodeUI => Boolean(ui));

    if (tool.mode !== "select") {
      app.editor?.cancel();
      return;
    }

    if (selectedUIs.length > 0) {
      app.editor?.select(selectedUIs);
      return;
    }

    app.editor?.cancel();
  }, [nodeMap, rootIds, selectedIds, tool.mode]);
}
