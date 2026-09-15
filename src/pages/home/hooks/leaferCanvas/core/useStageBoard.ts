import { useEffect } from "react";
import { Frame } from "leafer-ui";
import type { CanvasPage, EditorSelectionHandle, UseLeaferCanvasOptions } from "@/types";
import { getBoardLayout } from "../geometry/boardLayout";
import type { useRuntime } from "./useRuntime";

type Runtime = ReturnType<typeof useRuntime>;

type UseStageBoardParams = Pick<UseLeaferCanvasOptions, "viewRef" | "viewSize"> &
  Pick<Runtime, "appRef" | "boardRef" | "isSyncingEditorSelectionRef"> & {
    viewport: CanvasPage["viewport"];
  };

/** 白板外观按屏幕像素给，落进画板坐标前会除以显示缩放。 */
const BOARD_CHROME = {
  cornerRadius: 8,
  shadowBlur: 42,
  shadowY: 18,
  strokeWidth: 1,
};

/**
 * 维护画布舞台：`app.tree` 承载缩放和居中，`board` 是 1920 x 1080 白色业务画板。
 *
 * 缩放必须挂在 `app.tree` 上：`leafer-x-ruler` 按 `app.tree.scale` / `app.tree.worldTransform`
 * 校准刻度，挂在更内层它读不到，标尺就会按屏幕像素而不是业务坐标标注。
 * board 自身不缩放，只负责承载节点、裁剪和外观。
 */
export const useStageBoard = ({
  appRef,
  boardRef,
  isSyncingEditorSelectionRef,
  viewRef,
  viewSize,
  viewport,
}: UseStageBoardParams) => {
  const viewportHeight = viewport.height;
  const viewportWidth = viewport.width;

  useEffect(() => {
    let selectionFrameId: number | undefined;
    let isRefreshingSelection = false;
    const app = appRef.current;

    // LeaferApp 还没初始化时，等初始化 effect 完成后再同步容器。
    if (!app) return;

    /**
     * 画布变换后，Editor 仍持有旧的控制框布局缓存。
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

    // board 是稳定容器：尺寸变化只更新变换和外观，不重建节点 UI。
    const viewWidth = viewSize?.width ?? viewRef.current?.clientWidth ?? viewportWidth;
    const viewHeight = viewSize?.height ?? viewRef.current?.clientHeight ?? viewportHeight;
    const layout = getBoardLayout(viewWidth, viewHeight, {
      height: viewportHeight,
      width: viewportWidth,
    });
    const treeInput = {
      scale: layout.scale,
      x: layout.boardX,
      y: layout.boardY,
    };
    /**
     * 外观按屏幕像素给，所以先除以显示缩放换算回画板坐标。
     * 不换算的话 1px 描边在缩放到 0.375 时会变成 0.375px 直接看不见，圆角也会跟着变小。
     */
    const boardUnit = layout.scale > 0 ? 1 / layout.scale : 1;
    const boardInput = {
      // board 不参与编辑，只作为白色画板和节点父容器。
      cornerRadius: BOARD_CHROME.cornerRadius * boardUnit,
      editable: false,
      fill: "#ffffff",
      height: viewportHeight,
      overflow: "hide" as const,
      shadow: {
        blur: BOARD_CHROME.shadowBlur * boardUnit,
        color: "rgba(15, 23, 42, 0.14)",
        x: 0,
        y: BOARD_CHROME.shadowY * boardUnit,
      },
      stroke: "#d9dee8",
      strokeWidth: BOARD_CHROME.strokeWidth * boardUnit,
      width: viewportWidth,
      x: 0,
      y: 0,
    };

    if (!boardRef.current) {
      // 首次进入时创建稳定容器，并挂到 Leafer app.tree；之后不再清空 app.tree。
      const board = new Frame(boardInput);

      boardRef.current = board;
      app.tree.set(treeInput);
      app.tree.add(board);
      return;
    }

    // 尺寸变化只更新变换和外观，保留所有节点 UI 实例和媒体加载状态。
    app.tree.set(treeInput);
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
    viewportHeight,
    viewportWidth,
    viewRef,
    viewSize?.height,
    viewSize?.width,
  ]);
};
