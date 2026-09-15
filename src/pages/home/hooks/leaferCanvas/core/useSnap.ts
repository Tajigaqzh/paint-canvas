import { useEffect, useRef } from "react";
import { Snap } from "leafer-x-easy-snap";
import type { UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "./useRuntime";

type Runtime = ReturnType<typeof useRuntime>;

type UseSnapParams = Pick<UseLeaferCanvasOptions, "tool" | "viewSize"> &
  Pick<Runtime, "appRef" | "boardRef">;

/** 吸附范围按屏幕像素给，换算成画板像素后插件内部的比较空间才对得上。 */
const SNAP_SIZE_PX = 5;

/**
 * 接入 leafer-x-easy-snap：拖动节点时对齐参考线 + 自动吸附。
 *
 * 几个必须注意的点：
 * 1. `parentContainer` 传 board 而不是 app.tree：插件只收集
 *    `[parentContainer, ...parentContainer.children]`，不递归。传 app.tree 就只剩 board 一个候选。
 * 2. 插件用 `getBounds('box', app.tree)` 取包围盒，量出来是 app.tree 的局部坐标；
 *    画布缩放挂在 app.tree 上（见 useStageBoard），所以这里 1 个单位就是 1 个画板像素，
 *    `snapSize` 必须按显示缩放换算，否则缩放后吸附范围会跟着一起变小。
 * 3. 只有 select 模式能拖节点，其它工具直接关闭，避免多挂一组 editor / pointer 监听。
 */
export const useSnap = ({ appRef, boardRef, tool, viewSize }: UseSnapParams) => {
  const snapRef = useRef<Snap | null>(null);
  const mode = tool.mode;

  // app 和 board 都是稳定实例，这个 effect 只跑一次。
  useEffect(() => {
    const app = appRef.current;
    const board = boardRef.current;

    if (!app || !board) return undefined;

    const snap = new Snap(app, {
      // 距离标签和等间距提示先关掉：参考线本身噪声已经够低，需要时再开。
      parentContainer: board,
      showDistanceLabels: false,
      showEqualSpacingBoxes: false,
    });

    snapRef.current = snap;

    return () => {
      snap.enable(false);
      snapRef.current = null;
    };
  }, [appRef, boardRef]);

  // app.tree 的缩放由 useStageBoard 维护；这个 effect 声明在它后面，能读到最新值。
  useEffect(() => {
    const snap = snapRef.current;
    // Leafer 的 scale 允许百分比字符串，这里统一取数字。
    const scale = Number(appRef.current?.tree.scale);

    if (!snap || !(scale > 0)) return;

    snap.updateConfig({ snapSize: SNAP_SIZE_PX / scale });
  }, [appRef, viewSize]);

  useEffect(() => {
    snapRef.current?.enable(mode === "select");
  }, [mode]);
};
