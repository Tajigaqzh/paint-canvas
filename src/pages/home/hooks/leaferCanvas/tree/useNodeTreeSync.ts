import { useEffect, useRef } from "react";
import type { CanvasPage, ParentNodeUI } from "@/types";
import type { useRuntime } from "../core/useRuntime";
import { syncCanvasPageToLeafer } from "./syncNodeTree";

type Runtime = ReturnType<typeof useRuntime>;

type UseNodeTreeSyncParams = Pick<
  Runtime,
  | "appRef"
  | "boardRef"
  | "isSyncingEditorSelectionRef"
  | "onSelectNodeRef"
  | "onUpdateNodeRef"
  | "pageRef"
  | "uiKindMapRef"
  | "uiMapRef"
  | "uiParentMapRef"
> &
  Pick<CanvasPage, "nodeMap" | "rootIds">;

/**
 * 将 CanvasPage 的 nodeMap / rootIds 增量同步到 Leafer UI 树。
 *
 * hook 只负责在 board 就绪后触发同步；创建 / 复用 / 排序 / 删除细节在 syncNodeTree。
 * 本轮从 rootIds / childrenIds 访问不到的 UI 视为 stale 并销毁。
 */
export const useNodeTreeSync = ({
  appRef,
  boardRef,
  isSyncingEditorSelectionRef,
  nodeMap,
  onSelectNodeRef,
  onUpdateNodeRef,
  pageRef,
  rootIds,
  uiKindMapRef,
  uiMapRef,
  uiParentMapRef,
}: UseNodeTreeSyncParams) => {
  const uiMap = uiMapRef.current;
  const uiKindMap = uiKindMapRef.current;
  const uiParentMap = uiParentMapRef.current;
  const animationSignatureMapRef = useRef(new Map<string, string>());

  useEffect(() => {
    const board = boardRef.current as ParentNodeUI | null;

    if (!board) return;

    syncCanvasPageToLeafer(
      {
        animationSignatureMap: animationSignatureMapRef.current,
        app: appRef.current,
        board,
        isSyncingEditorSelectionRef,
        nodeMap,
        onSelectNodeRef,
        onUpdateNodeRef,
        pageRef,
        uiKindMap,
        uiMap,
        uiParentMap,
      },
      rootIds,
    );
  }, [
    appRef,
    boardRef,
    isSyncingEditorSelectionRef,
    nodeMap,
    onSelectNodeRef,
    onUpdateNodeRef,
    pageRef,
    rootIds,
    uiKindMap,
    uiMap,
    uiParentMap,
  ]);
};
