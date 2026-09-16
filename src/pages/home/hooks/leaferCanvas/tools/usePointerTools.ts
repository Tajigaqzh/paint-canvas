import type { UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "../core/useRuntime";
import { useBrushTool } from "./useBrushTool";
import { useEraserTool } from "./useEraserTool";

type Runtime = ReturnType<typeof useRuntime>;

type UsePointerToolsParams = Pick<UseLeaferCanvasOptions, "tool" | "erasableFilter"> & Runtime;

/**
 * 组合画笔与橡皮擦两个工具。
 *
 * 手势采样、实时预览、命中检测都在 leafer-x-brush-eraser 插件里，
 * 这里只做两件事：把插件事件接到 store action，以及按当前工具模式开关两个插件。
 *
 * 两个插件都需要 board 作为坐标空间和预览容器，所以整组必须晚于 useStageBoard。
 */
export const usePointerTools = ({ tool, erasableFilter, ...runtime }: UsePointerToolsParams) => {
  useBrushTool({
    boardRef: runtime.boardRef,
    onAddDrawLineRef: runtime.onAddDrawLineRef,
    tool,
  });

  useEraserTool({
    boardRef: runtime.boardRef,
    erasableFilter,
    onApplyEraserResultRef: runtime.onApplyEraserResultRef,
    tool,
    uiKindMapRef: runtime.uiKindMapRef,
    uiMapRef: runtime.uiMapRef,
  });
};
