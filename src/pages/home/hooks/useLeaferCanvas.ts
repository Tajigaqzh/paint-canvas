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
  Rect,
  Text,
  type IUI,
} from "leafer-ui";
import type { CanvasDocument, CanvasNode, EditableNodeUI, EditorHandle } from "@/pages/home/types";

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
  /** 可序列化画布文档，是渲染 Leafer 的唯一数据源。 */
  document: CanvasDocument;
  /** 画布元素点击时同步选中状态。 */
  onSelectNode: (id: string, additive?: boolean) => void;
  /** 编辑器框选完成时，把 Leafer 的选中 UI 数组同步回 store。 */
  onSelectNodes: (ids: string[]) => void;
  /** Leafer 拖拽/编辑结束后，把位置尺寸写回 store。 */
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
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
      draggable: true,
      editable: true,
      fill: node.fill,
      height: node.height,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      width: node.width,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  if (node.kind === "text") {
    return new Text({
      draggable: true,
      editable: true,
      fill: node.fill,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      origin: node.transformOrigin ?? "center",
      rotation: node.rotation ?? 0,
      text: node.text,
      x: node.x,
      y: node.y,
    }) as EditableNodeUI;
  }

  return new Rect({
    cornerRadius: node.cornerRadius,
    draggable: true,
    editable: true,
    fill: node.fill,
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

  return {
    height: Math.round(ui.height ?? node.height),
    rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
    width: Math.round(ui.width ?? node.width),
    x: Math.round(ui.x ?? node.x),
    y: Math.round(ui.y ?? node.y),
  };
};

export function useLeaferCanvas({
  document,
  onSelectNode,
  onSelectNodes,
  onUpdateNode,
  viewRef,
  viewSize,
}: UseLeaferCanvasOptions) {
  const appRef = useRef<EditableLeaferApp | null>(null);
  const documentRef = useRef(document);
  const onSelectNodesRef = useRef(onSelectNodes);
  const uiMapRef = useRef(new Map<string, EditableNodeUI>());
  const { nodeMap, rootIds, selectedIds, viewport } = document;

  useEffect(() => {
    documentRef.current = document;
    onSelectNodesRef.current = onSelectNodes;
  }, [document, onSelectNodes]);

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
    const syncEditorSelection = (event: EditorSelectEvent) => {
      const list =
        event.list ?? (Array.isArray(event.value) ? event.value : event.value ? [event.value] : []);
      const ids = list.map((item) => getIdByUI(item)).filter((id): id is string => Boolean(id));

      onSelectNodesRef.current(ids);
    };

    app.editor?.on(EditorEvent.SELECT, syncEditorSelection);
    app.editor?.on(InnerEditorEvent.CLOSE, (event: InnerEditorCloseEvent) => {
      const matched = [...uiMap.entries()].find(([, ui]) => ui === event.editTarget);

      if (!matched || event.editTarget?.text === undefined) return;

      onUpdateNode(matched[0], { text: String(event.editTarget.text) });
    });

    return () => {
      app.destroy();
      appRef.current = null;
      uiMap.clear();
    };
  }, [onUpdateNode, viewRef]);

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

    if (selectedUIs.length > 0) {
      app.editor?.select(selectedUIs);
      return;
    }

    app.editor?.cancel();
  }, [nodeMap, rootIds, selectedIds]);
}
