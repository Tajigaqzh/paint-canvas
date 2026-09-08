import { useEffect } from "react";
import { Line } from "leafer-ui";
import type { CanvasPoint, ToolDrawingState, UseLeaferCanvasOptions } from "@/types";
import { getBoardLayout, mapClientPointToBoard } from "../geometry/boardLayout";
import { getPointDistance } from "../geometry/hitDetection";
import type { useRuntime } from "../core/useRuntime";
import { getNormalizedLineNodeInput } from "./brush";
import {
  appendPointToActiveLinePreviews,
  cleanupLineEraserPreviews,
  eraseAtPoint,
  getLineEraserUpdates,
} from "./eraser";

type Runtime = ReturnType<typeof useRuntime>;

type UsePointerToolsParams = Pick<UseLeaferCanvasOptions, "viewRef" | "viewSize"> & Runtime;

/**
 * 接管 brush / eraser 的 pointer 手势。
 *
 * select 完全交给 Leafer Editor；brush / eraser 在 DOM pointerdown 后绑定 window
 * 级 move/up，保证拖出画板时仍能结束绘制或擦除。坐标换算与 stage 共用 getBoardLayout。
 */
export const usePointerTools = ({
  boardRef,
  drawingRef,
  onAddDrawLineRef,
  onApplyEraserResultRef,
  onSelectNodeRef,
  pageRef,
  toolRef,
  uiKindMapRef,
  uiMapRef,
  uiParentMapRef,
  viewRef,
  viewSize,
}: UsePointerToolsParams) => {
  const uiMap = uiMapRef.current;
  const uiKindMap = uiKindMapRef.current;
  const uiParentMap = uiParentMapRef.current;

  useEffect(() => {
    const getCanvasPoint = (event: PointerEvent): CanvasPoint | undefined => {
      const view = viewRef.current;

      if (!view) return undefined;

      const rect = view.getBoundingClientRect();
      const layout = getBoardLayout(
        viewSize?.width ?? rect.width,
        viewSize?.height ?? rect.height,
        pageRef.current.viewport,
      );

      return mapClientPointToBoard(
        event.clientX,
        event.clientY,
        rect,
        layout,
        pageRef.current.viewport,
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      const activeTool = toolRef.current;

      if (activeTool.mode === "select") return;

      const point = getCanvasPoint(event);

      if (!point) return;

      event.preventDefault();
      event.stopPropagation();
      onSelectNodeRef.current(undefined);

      const drawing: ToolDrawingState = {
        erasedIds: new Set(),
        lineErasers: new Map(),
        pointerId: event.pointerId,
        points: [point.x, point.y],
      };

      drawingRef.current = drawing;

      if (activeTool.mode === "brush") {
        const tempLine = new Line({
          curve: 0.2,
          editable: false,
          fill: "transparent",
          points: [...drawing.points],
          stroke: "#111827",
          strokeCap: "round",
          strokeWidth: activeTool.brushSize,
          x: 0,
          y: 0,
        });

        boardRef.current?.add(tempLine);
        drawing.tempLine = tempLine;
      } else {
        eraseAtPoint(drawing, pageRef.current, uiMap, point, activeTool.eraserSize);
      }

      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      const point = getCanvasPoint(event);

      if (!point) return;

      event.preventDefault();
      event.stopPropagation();

      if (toolRef.current.mode === "brush") {
        const lastY = drawing.points[drawing.points.length - 1] ?? point.y;
        const lastX = drawing.points[drawing.points.length - 2] ?? point.x;

        if (getPointDistance({ x: lastX, y: lastY }, point) < 2) return;

        drawing.points.push(point.x, point.y);

        if (drawing.tempLine) {
          drawing.tempLine.points = [...drawing.points];
        }
        return;
      }

      drawing.points.push(point.x, point.y);
      appendPointToActiveLinePreviews(drawing, point, toolRef.current.eraserSize);
      eraseAtPoint(drawing, pageRef.current, uiMap, point, toolRef.current.eraserSize);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);

      if (toolRef.current.mode === "brush") {
        drawing.tempLine?.destroy();

        const lineInput = getNormalizedLineNodeInput(drawing.points, toolRef.current.brushSize);

        if (lineInput) {
          onAddDrawLineRef.current(lineInput);
        }
      } else {
        const lineErasers = getLineEraserUpdates(drawing, toolRef.current.eraserSize);

        cleanupLineEraserPreviews(drawing);
        onApplyEraserResultRef.current([...drawing.erasedIds], lineErasers);
      }

      drawingRef.current = null;
    };

    const view = viewRef.current;

    if (!view) return undefined;

    view.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      view.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [
    boardRef,
    drawingRef,
    onAddDrawLineRef,
    onApplyEraserResultRef,
    onSelectNodeRef,
    pageRef,
    toolRef,
    uiKindMap,
    uiMap,
    uiParentMap,
    viewRef,
    viewSize?.height,
    viewSize?.width,
  ]);
};
