import { useEffect, useRef } from "react";
import type { Frame, Group } from "leafer-ui";
import type { CanvasNode } from "@/types";
import type {
  EditableLeaferApp,
  ManagedNodeUI,
  ParentNodeUI,
  ToolDrawingState,
  UseLeaferCanvasOptions,
} from "../shared/types";

/**
 * 创建 useLeaferCanvas 各子模块共享的稳定 runtime refs。
 *
 * Leafer 原生事件不走 React 生命周期，必须通过这些 refs 读取最新页面数据、
 * 当前工具配置和 store action，同时保持 LeaferApp / UI Map 不随 render 重建。
 */
export const useLeaferCanvasRuntime = ({
  onAddDrawLine,
  onApplyEraserResult,
  onSelectNode,
  onSelectNodes,
  onUpdateNode,
  onUpdateNodes,
  page,
  tool,
}: Omit<UseLeaferCanvasOptions, "viewRef" | "viewSize">) => {
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

  return {
    appRef,
    boardRef,
    drawingRef,
    isSyncingEditorSelectionRef,
    onAddDrawLineRef,
    onApplyEraserResultRef,
    onSelectNodeRef,
    onSelectNodesRef,
    onUpdateNodeRef,
    onUpdateNodesRef,
    pageRef,
    stageRef,
    toolRef,
    uiKindMapRef,
    uiMapRef,
    uiParentMapRef,
  };
};
