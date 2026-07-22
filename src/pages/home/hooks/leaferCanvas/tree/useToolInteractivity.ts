import { useEffect } from "react";
import type { CanvasPage } from "@/types";
import type { UseLeaferCanvasOptions } from "../shared/types";
import type { useLeaferCanvasRuntime } from "../core/useLeaferCanvasRuntime";

type Runtime = ReturnType<typeof useLeaferCanvasRuntime>;

type UseToolInteractivityParams = Pick<UseLeaferCanvasOptions, "tool"> &
  Pick<CanvasPage, "nodeMap" | "rootIds"> &
  Pick<Runtime, "uiMapRef">;

/**
 * 根据当前工具模式切换 Leafer 托管 UI 的编辑和拖拽能力。
 *
 * brush / eraser 模式下关闭 editable / draggable，避免 Editor hover 框和自定义工具冲突；
 * select 模式下恢复 Leafer Editor 的选择、拖拽和编辑能力。
 */
export const useToolInteractivity = ({
  nodeMap,
  rootIds,
  tool,
  uiMapRef,
}: UseToolInteractivityParams) => {
  const uiMap = uiMapRef.current;

  /** 根据当前工具模式切换 Leafer Editor 是否可以接管节点。 */
  useEffect(() => {
    const canUseEditor = tool.mode === "select";

    /**
     * brush / eraser 都是自定义 pointer 工具。
     * 如果节点仍保持 editable=true，Leafer Editor 即使没有选区，也会在 hover 时显示紫色可选框。
     * 因此非 select 模式下临时关闭托管 UI 的编辑和拖拽能力；自定义橡皮擦命中走 store 数据，不依赖 Leafer hit。
     */
    uiMap.forEach((ui) => {
      ui.set({
        draggable: canUseEditor,
        editable: canUseEditor,
      });
    });
  }, [nodeMap, rootIds, tool.mode, uiMap]);
};
