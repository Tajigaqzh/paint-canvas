import type {
  CanvasLineEraserUpdate,
  CanvasPage,
  CanvasPoint,
  LineEraserPreview,
  LineGroupUI,
  LineNode,
  ManagedNodeUI,
  ToolDrawingState,
} from "@/types";
import { findHitNode, getLineLocalPoint, getPreviewLocalPoint } from "../geometry/hitDetection";
import { createLineEraserUI, getLineEraserInput } from "../ui/lineUi";

/**
 * 给某条 line 的实时 eraser 预览追加一个路径点。
 * 传入的是画板全局坐标，临时 Line 挂在 line group 内，需先转成局部坐标。
 */
export const appendPointToLinePreview = (
  preview: LineEraserPreview,
  point: CanvasPoint,
  eraserSize: number,
) => {
  const localPoint = getPreviewLocalPoint(preview, point);
  const lastX = preview.path[preview.path.length - 2];
  const lastY = preview.path[preview.path.length - 1];

  if (lastX === localPoint.x && lastY === localPoint.y) return;

  preview.path.push(localPoint.x, localPoint.y);
  preview.tempLine.set(getLineEraserInput(preview.path, eraserSize));
};

/** 本次手势已命中过的 line 都跟随完整鼠标轨迹，避免路径断成多个片段。 */
export const appendPointToActiveLinePreviews = (
  drawing: ToolDrawingState,
  point: CanvasPoint,
  eraserSize: number,
) => {
  drawing.lineErasers.forEach((preview) => {
    appendPointToLinePreview(preview, point, eraserSize);
  });
};

/**
 * 第一次命中某条 line 时在 group 内新建临时 eraser Line；
 * 后续只更新同一个临时 Line 的 points，由 Leafer 原生 eraser 实时渲染。
 */
export const updateLinePreview = (
  drawing: ToolDrawingState,
  uiMap: Map<string, ManagedNodeUI>,
  id: string,
  node: LineNode,
  parentOffset: CanvasPoint,
  eraserSize: number,
) => {
  const lineGroup = uiMap.get(id) as LineGroupUI | undefined;
  const lastPoint = {
    x: drawing.points[drawing.points.length - 2] ?? 0,
    y: drawing.points[drawing.points.length - 1] ?? 0,
  };

  if (!lineGroup) return;

  const localPoint = getLineLocalPoint(node, lastPoint, parentOffset);
  let preview = drawing.lineErasers.get(id);

  if (!preview) {
    const path = [localPoint.x, localPoint.y];
    const tempLine = createLineEraserUI(path, eraserSize);

    lineGroup.add?.(tempLine);
    drawing.lineErasers.set(id, {
      nodeX: node.x,
      nodeY: node.y,
      parentOffset,
      path,
      tempLine,
    });
    return;
  }

  appendPointToLinePreview(preview, lastPoint, eraserSize);
};

/** 松手前销毁临时预览 Line，避免和随后按 store.eraserPaths 重建的持久子节点叠两遍。 */
export const cleanupLineEraserPreviews = (drawing: ToolDrawingState) => {
  drawing.lineErasers.forEach((preview) => {
    preview.tempLine.destroy();
  });
  drawing.lineErasers.clear();
};

/** 把本次手势的 line 局部路径转成 store 提交数据；不直接写 store。 */
export const getLineEraserUpdates = (
  drawing: ToolDrawingState,
  eraserSize: number,
): CanvasLineEraserUpdate[] =>
  [...drawing.lineErasers.entries()]
    .map(([id, preview]) => ({
      id,
      points: [...preview.path],
      strokeWidth: eraserSize,
    }))
    .filter((update) => update.points.length >= 2);

/**
 * 在指定画板坐标做一次橡皮擦命中。
 * 只处理 line：不整条删除，只更新 line group 内的 eraser 预览。
 */
export const eraseAtPoint = (
  drawing: ToolDrawingState,
  page: CanvasPage,
  uiMap: Map<string, ManagedNodeUI>,
  point: CanvasPoint,
  eraserSize: number,
) => {
  const hit = findHitNode(page, page.rootIds, point, eraserSize / 2);
  const node = hit ? page.nodeMap[hit.id] : undefined;

  if (!hit || !node || node.kind !== "line") return;

  updateLinePreview(drawing, uiMap, hit.id, node, hit.offset, eraserSize);
};
