import { useEffect, useRef } from "react";
import { Ruler } from "leafer-x-ruler";
import { BOARD_INSET } from "../geometry/boardLayout";
import type { useRuntime } from "./useRuntime";

type Runtime = ReturnType<typeof useRuntime>;

type UseRulerParams = Pick<Runtime, "appRef">;

/**
 * 接入 leafer-x-ruler：画布视图左上角的标尺。
 *
 * 标尺按 `app.tree.scale` / `app.tree.worldTransform` 反算刻度值，
 * 所以画布缩放必须挂在 `app.tree` 上（见 useStageBoard），否则刻度会按屏幕像素标注。
 * 刻度条宽度和 `BOARD_INSET` 是同一个值，白板会主动让开这条空间，不会被刻度条压住。
 */
export const useRuler = ({ appRef }: UseRulerParams) => {
  const rulerRef = useRef<Ruler | null>(null);

  useEffect(() => {
    const app = appRef.current;

    // App 还没创建时等初始化 effect 完成，Ruler 构造需要 app.editor。
    if (!app) return undefined;

    const ruler = new Ruler(app, {
      ruleSize: BOARD_INSET,
      theme: "light",
      unit: "px",
    });

    /**
     * 标尺层是盖在画布上的独立 Leafer 层，默认可以命中指针，
     * 会在整块视图上挡住 Leafer Editor 的点击和拖拽，所以关掉它的命中。
     */
    ruler.rulerLeafer.canvas.hittable = false;
    rulerRef.current = ruler;

    return () => {
      ruler.enabled = false;
      ruler.dispose();
      rulerRef.current = null;
    };
  }, [appRef]);
};
