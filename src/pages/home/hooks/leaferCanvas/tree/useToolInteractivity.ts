import { useEffect } from "react";
import type { CanvasPage, UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "../core/useRuntime";

type Runtime = ReturnType<typeof useRuntime>;

type UseToolInteractivityParams = Pick<UseLeaferCanvasOptions, "tool" | "readOnly"> &
  Pick<CanvasPage, "nodeMap" | "rootIds"> &
  Pick<Runtime, "uiMapRef">;

/**
 * 根据当前工具模式切换 Leafer 托管 UI 的编辑和拖拽能力。
 *
 * 只有 select 模式放开 editable / draggable；brush / eraser / magnifier 都关闭，
 * 避免 Editor hover 框和自定义工具冲突，也避免放大镜悬停时误拖节点。
 * 预览只读模式（readOnly）下，无论什么工具都强制不可编辑 / 不可拖拽。
 */
export const useToolInteractivity = ({
  nodeMap,
  readOnly,
  rootIds,
  tool,
  uiMapRef,
}: UseToolInteractivityParams) => {
  const uiMap = uiMapRef.current;

  /** 根据当前工具模式切换 Leafer Editor 是否可以接管节点。 */
  useEffect(() => {
    const canUseEditor = tool.mode === "select" && !readOnly;

    /**
     * brush / eraser / magnifier 都是自定义工具，不靠 Leafer Editor 交互。
     * 如果节点仍保持 editable=true，Leafer Editor 即使没有选区，也会在 hover 时显示紫色可选框。
     * 因此非 select 模式下临时关闭托管 UI 的编辑和拖拽能力；自定义橡皮擦命中走 store 数据，不依赖 Leafer hit。
     * 放大镜只是 hover 取样，同样不能让节点跟着指针被拖走。
     */
    uiMap.forEach((ui) => {
      ui.set({
        draggable: canUseEditor,
        editable: canUseEditor,
      });
    });
  }, [nodeMap, rootIds, tool.mode, readOnly, uiMap]);
};
