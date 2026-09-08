import type { CanvasNode } from "@/types";

export type RenderContext = OffscreenCanvasRenderingContext2D;

export type PageImages = Map<string, ImageBitmap>;

export type VisibleStrokeNode = CanvasNode & {
  stroke: string;
  strokeWidth: number;
};

/** worker 内绘制橡皮擦路径时临时使用的最小描边节点结构。 */
export type EraserStrokeNode = {
  /** 橡皮擦路径在 destination-out 下只使用 alpha，具体颜色不影响结果。 */
  stroke: string;
  /** 橡皮擦端点保持 round，和主画布 Leafer eraser Line 一致。 */
  strokeCap?: CanvasNode["strokeCap"];
  /** 橡皮擦路径样式，当前始终为 solid。 */
  strokeStyle?: CanvasNode["strokeStyle"];
  /** 橡皮擦宽度。 */
  strokeWidth: number;
};

export type StrokeNode = CanvasNode | EraserStrokeNode;
