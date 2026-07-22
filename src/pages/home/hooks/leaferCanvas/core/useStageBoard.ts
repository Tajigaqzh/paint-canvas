import { useEffect } from "react";
import { Frame, Group } from "leafer-ui";
import type { CanvasPage } from "@/types";
import type { EditorSelectionHandle, UseLeaferCanvasOptions } from "../shared/types";
import type { useLeaferCanvasRuntime } from "./useLeaferCanvasRuntime";

type Runtime = ReturnType<typeof useLeaferCanvasRuntime>;

type UseStageBoardParams = Pick<UseLeaferCanvasOptions, "viewRef" | "viewSize"> &
  Pick<Runtime, "appRef" | "boardRef" | "isSyncingEditorSelectionRef" | "stageRef"> & {
    viewport: CanvasPage["viewport"];
  };

/**
 * 维护 Leafer 的稳定 stage / board 容器。
 *
 * stage 负责把 1920 x 1080 业务坐标缩放居中到 DOM 容器；
 * board 是白色画板根容器，尺寸变化只 set 属性，不重建业务节点。
 */
export const useStageBoard = ({
  appRef,
  boardRef,
  isSyncingEditorSelectionRef,
  stageRef,
  viewRef,
  viewSize,
  viewport,
}: UseStageBoardParams) => {
  useEffect(() => {
    let selectionFrameId: number | undefined;
    let isRefreshingSelection = false;
    const app = appRef.current;

    // LeaferApp 还没初始化时，等初始化 effect 完成后再同步容器。
    if (!app) return;

    /**
     * stage 缩放/居中后，Editor 仍持有旧的控制框布局缓存。
     * 下一帧重新 select 当前 list，强制 Leafer 按新的坐标变换计算多选框宽高。
     */
    const refreshEditorSelectionFrame = () => {
      const editor = app.editor as EditorSelectionHandle | undefined;

      if (!editor?.list?.length) return;

      isRefreshingSelection = true;
      isSyncingEditorSelectionRef.current = true;
      selectionFrameId = requestAnimationFrame(() => {
        const latestEditor = appRef.current?.editor as EditorSelectionHandle | undefined;
        const selectedList = latestEditor?.list?.filter(Boolean) ?? [];

        if (selectedList.length > 0) {
          latestEditor?.select([...selectedList]);
        }

        queueMicrotask(() => {
          isRefreshingSelection = false;
          isSyncingEditorSelectionRef.current = false;
        });
      });
    };

    // stage / board 是稳定容器：尺寸变化只更新缩放和白板尺寸，不重建节点 UI。
    const viewWidth = viewSize?.width ?? viewRef.current?.clientWidth ?? viewport.width;
    const viewHeight = viewSize?.height ?? viewRef.current?.clientHeight ?? viewport.height;
    const scale = Math.min(viewWidth / viewport.width, viewHeight / viewport.height);
    const stageInput = {
      // stage 缩放把 1920 x 1080 业务坐标映射到当前 DOM 像素尺寸。
      scale,
      // x/y 负责把缩放后的白色画板在 canvas 容器中居中。
      x: Math.max((viewWidth - viewport.width * scale) / 2, 0),
      y: Math.max((viewHeight - viewport.height * scale) / 2, 0),
    };
    const boardInput = {
      // board 不参与编辑，只作为白色画板和节点父容器。
      editable: false,
      fill: "#ffffff",
      height: viewport.height,
      overflow: "hide" as const,
      stroke: "#d9dee8",
      width: viewport.width,
      x: 0,
      y: 0,
    };

    if (!stageRef.current || !boardRef.current) {
      // 首次进入时创建稳定容器，并挂到 Leafer app.tree；之后不再清空 app.tree。
      const stage = new Group(stageInput);
      const board = new Frame(boardInput);

      boardRef.current = board;
      stageRef.current = stage;
      stage.add(board);
      app.tree.add(stage);
      return;
    }

    // 尺寸变化只更新容器属性，保留所有节点 UI 实例和媒体加载状态。
    stageRef.current.set(stageInput);
    boardRef.current.set(boardInput);
    refreshEditorSelectionFrame();

    return () => {
      if (selectionFrameId !== undefined) {
        cancelAnimationFrame(selectionFrameId);
      }

      if (isRefreshingSelection) {
        isSyncingEditorSelectionRef.current = false;
      }
    };
  }, [
    appRef,
    boardRef,
    isSyncingEditorSelectionRef,
    stageRef,
    viewport.height,
    viewport.width,
    viewRef,
    viewSize?.height,
    viewSize?.width,
  ]);
};
