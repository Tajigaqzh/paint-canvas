import { useEffect, useRef } from "react";
import { Brush } from "leafer-x-brush-eraser";
import type { UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "../core/useRuntime";
import { getLineNodeInput } from "./lineNodeInput";

type Runtime = ReturnType<typeof useRuntime>;

type UseBrushToolParams = Pick<UseLeaferCanvasOptions, "tool"> &
  Pick<Runtime, "boardRef" | "onAddDrawLineRef">;

/**
 * 画笔工具接线。
 *
 * 手势采样和实时预览交给 leafer-x-brush-eraser，这里只把 `draw` 事件转成
 * store 的 line 输入提交。依赖 board，所以必须晚于 useStageBoard 执行。
 */
export const useBrushTool = ({ boardRef, onAddDrawLineRef, tool }: UseBrushToolParams) => {
  const brushRef = useRef<Brush | null>(null);
  const mode = tool.mode;
  const strokeWidth = tool.brushSize;
  const stroke = tool.brushColor;

  useEffect(() => {
    const board = boardRef.current;

    // board 还没建出来时，等 useStageBoard 的 effect 跑完再说。
    if (!board) return undefined;

    // 初始粗细/颜色先用插件默认值，紧跟的同步 effect 会立刻用宿主的值覆盖，不会有一帧偏差。
    const brush = new Brush({ container: board });

    brush.on("draw", (event) => {
      onAddDrawLineRef.current(getLineNodeInput(event));
    });

    brushRef.current = brush;

    return () => {
      brush.dispose();
      brushRef.current = null;
    };
  }, [boardRef, onAddDrawLineRef]);

  // 只有画笔模式接管手势；粗细与颜色变化同步给插件。
  useEffect(() => {
    const brush = brushRef.current;

    if (!brush) return;

    brush.set({ strokeWidth });
    if (stroke) brush.set({ stroke });
    brush.enabled = mode === "brush";
  }, [mode, strokeWidth, stroke]);
};
