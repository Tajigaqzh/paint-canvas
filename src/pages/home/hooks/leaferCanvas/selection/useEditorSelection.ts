import { useEffect } from "react";
import type { CanvasPage, EditableNodeUI } from "@/types";
import type { EditorSelectionHandle, UseLeaferCanvasOptions } from "../shared/types";
import type { useLeaferCanvasRuntime } from "../core/useLeaferCanvasRuntime";

type Runtime = ReturnType<typeof useLeaferCanvasRuntime>;

type UseEditorSelectionParams = Pick<UseLeaferCanvasOptions, "tool"> &
  Pick<CanvasPage, "nodeMap" | "rootIds" | "selectedIds"> &
  Pick<Runtime, "appRef" | "isSyncingEditorSelectionRef" | "uiMapRef">;

/**
 * 将 store.selectedIds 单向同步到 Leafer Editor 选择框。
 *
 * 用户操作到 store 的方向由 useLeaferApp 监听 EditorEvent.SELECT 处理；
 * 这里只处理 React 状态变化后如何调用 editor.select / editor.cancel。
 */
export const useEditorSelection = ({
  appRef,
  isSyncingEditorSelectionRef,
  nodeMap,
  rootIds,
  selectedIds,
  tool,
  uiMapRef,
}: UseEditorSelectionParams) => {
  const uiMap = uiMapRef.current;

  /** 将 store.selectedIds 同步到 Leafer Editor 选择框。 */
  useEffect(() => {
    const app = appRef.current;

    // App 未初始化时不做选择同步。
    if (!app) return;

    // 运行时 Editor 有 list 字段，可用于避免重复 select 同一组 UI。
    const editor = app.editor as EditorSelectionHandle | undefined;
    // selectedIds 是业务 id，需要映射成当前仍存在的 Leafer UI。
    const selectedUIs = selectedIds
      .map((id) => uiMap.get(id))
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
  }, [appRef, isSyncingEditorSelectionRef, nodeMap, rootIds, selectedIds, tool.mode, uiMap]);
};
