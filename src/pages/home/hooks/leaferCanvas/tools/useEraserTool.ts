import { useEffect, useRef } from "react";
import { Eraser } from "leafer-x-brush-eraser";
import type { UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "../core/useRuntime";
import { findErasableLineNodeId, getLineEraserUpdates } from "./eraserUpdates";

type Runtime = ReturnType<typeof useRuntime>;

type UseEraserToolParams = Pick<UseLeaferCanvasOptions, "tool" | "erasableFilter"> &
  Pick<Runtime, "boardRef" | "onApplyEraserResultRef" | "uiKindMapRef" | "uiMapRef">;

/**
 * 橡皮擦工具接线。
 *
 * 手势与命中（Leafer 选择器）交给 leafer-x-brush-eraser，`erasable` 先限定只擦 line 节点，
 * 再叠加宿主传入的 `erasableFilter`（预览页用它把范围收窄到批注笔迹）；
 * 一次手势结束才把轨迹提交给 store，保证一次擦除只进一条历史记录。
 */
export const useEraserTool = ({
  boardRef,
  erasableFilter,
  onApplyEraserResultRef,
  tool,
  uiKindMapRef,
  uiMapRef,
}: UseEraserToolParams) => {
  const eraserRef = useRef<Eraser | null>(null);
  const erasableFilterRef = useRef(erasableFilter);
  const mode = tool.mode;
  const strokeWidth = tool.eraserSize;

  // 宿主可擦范围可能随页面数据变化（如批注增删），用 ref 让擦除回调始终读到最新过滤条件。
  erasableFilterRef.current = erasableFilter;

  useEffect(() => {
    const board = boardRef.current;

    // board 还没建出来时，等 useStageBoard 的 effect 跑完再说。
    if (!board) return undefined;

    const maps = { uiKindMap: uiKindMapRef.current, uiMap: uiMapRef.current };
    // 初始粗细先用插件默认值，紧跟的同步 effect 会立刻用宿主的值覆盖，不会有一帧偏差。
    const eraser = new Eraser({
      container: board,
      erasable: (target) => {
        const id = findErasableLineNodeId(target, maps);

        if (!id) return false;
        // 默认只擦 line 节点；传入 erasableFilter 时再叠加一层范围限制（如只擦批注）。
        return erasableFilterRef.current ? erasableFilterRef.current(id) : true;
      },
    });

    eraser.on("end", ({ strokes }) => {
      const updates = getLineEraserUpdates(strokes, maps);

      // 没擦到东西就不提交，避免空操作进历史。
      if (updates.length > 0) onApplyEraserResultRef.current([], updates);
    });

    eraserRef.current = eraser;

    return () => {
      eraser.dispose();
      eraserRef.current = null;
    };
  }, [boardRef, onApplyEraserResultRef, uiKindMapRef, uiMapRef]);

  // 只有橡皮擦模式接管手势；粗细变化同步给插件。
  useEffect(() => {
    const eraser = eraserRef.current;

    if (!eraser) return;

    eraser.set({ strokeWidth });
    eraser.enabled = mode === "eraser";
  }, [mode, strokeWidth]);
};
