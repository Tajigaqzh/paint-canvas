import type { CanvasMaterialKind, CanvasPoint, CanvasViewport } from "@/types";
import { getBoardLayout, mapClientPointToBoard } from "./hooks/leaferCanvas/geometry/boardLayout";

/** 素材拖拽自定义 MIME，避免和普通文本拖放混淆。 */
export const MATERIAL_DRAG_MIME = "application/x-paint-canvas-material";

const MATERIAL_KINDS = new Set<string>([
  "rect",
  "text",
  "line",
  "triangle",
  "polygon",
  "star",
  "circle",
  "ellipse",
  "ring",
  "sector",
  "sector-ring",
  "arc",
  "image",
]);

/** 同源拖拽时 dataTransfer 在 dragover 里不一定能读到自定义类型，用模块变量兜底。 */
let draggingMaterialKind: CanvasMaterialKind | undefined;

export const isCanvasMaterialKind = (value: string): value is CanvasMaterialKind =>
  MATERIAL_KINDS.has(value);

export const setDraggingMaterialKind = (kind?: CanvasMaterialKind) => {
  draggingMaterialKind = kind;
};

export const getDraggingMaterialKind = () => draggingMaterialKind;

/**
 * 把投放点从 client 坐标换成 1920×1080 业务坐标。
 * 白板外返回 undefined，调用方不应创建节点。
 */
export const mapMaterialDropPoint = (
  clientX: number,
  clientY: number,
  viewEl: HTMLElement,
  viewSize: { height: number; width: number },
  viewport: CanvasViewport,
): CanvasPoint | undefined => {
  const layout = getBoardLayout(viewSize.width, viewSize.height, viewport);

  return mapClientPointToBoard(clientX, clientY, viewEl.getBoundingClientRect(), layout, viewport);
};
