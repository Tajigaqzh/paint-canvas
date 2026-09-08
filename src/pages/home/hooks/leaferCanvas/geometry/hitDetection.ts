import type { CanvasPage, CanvasPoint, HitNodeResult, LineEraserPreview, LineNode } from "@/types";

/**
 * 计算两个业务坐标点之间的欧氏距离。
 *
 * 画笔拖动时会用它做采样节流，距离太近的点不写入 points，
 * 从而减少路径点数量和 Leafer 重绘压力。
 */
export const getPointDistance = (left: CanvasPoint, right: CanvasPoint) =>
  Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2);

/**
 * 计算一个点到线段的最短距离。
 *
 * 橡皮擦擦线条时不能只看 line 的外接矩形，否则会擦到没有经过的空白区域。
 * 这里把鼠标点投影到每一段路径上，用真实路径距离判断是否命中。
 */
export const getPointToSegmentDistance = (
  point: CanvasPoint,
  start: CanvasPoint,
  end: CanvasPoint,
) => {
  // 线段退化成一个点时，直接按点到点距离处理。
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx ** 2 + dy ** 2;

  if (lengthSquared === 0) return getPointDistance(point, start);

  // ratio 是点在线段方向上的投影比例，夹在 0~1 内表示最近点在线段上。
  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  // projection 是 point 在线段上的最近投影点。
  const projection = {
    x: start.x + ratio * dx,
    y: start.y + ratio * dy,
  };

  return getPointDistance(point, projection);
};

/**
 * 判断橡皮擦是否擦到一条 line 节点的真实路径。
 *
 * line 节点要实现“经过哪里擦哪里”，所以这里按 points 拆成多段线段检测。
 * 命中容差 = 橡皮擦半径 + 线条半宽，符合视觉上两条描边相交就算擦到的直觉。
 */
export const isPointNearLineNode = (
  node: LineNode,
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint,
) => {
  // 没有自定义 points 时，按从 (0,0) 到 (width,0) 的普通线条处理。
  const points = node.points?.length ? node.points : [0, 0, node.width, 0];
  // 线条命中半径 = 橡皮擦半径 + 线条半宽。
  const tolerance = radius + Math.max(node.strokeWidth ?? 0, 1) / 2;

  // points 按 x/y 成对排列，所以每次取相邻两个点构成一段。
  for (let index = 0; index < points.length - 2; index += 2) {
    const start = {
      x: node.x + offset.x + (points[index] ?? 0),
      y: node.y + offset.y + (points[index + 1] ?? 0),
    };
    const end = {
      x: node.x + offset.x + (points[index + 2] ?? 0),
      y: node.y + offset.y + (points[index + 3] ?? 0),
    };

    if (getPointToSegmentDistance(point, start, end) <= tolerance) return true;
  }

  return false;
};

/**
 * 从指定图层列表里找出橡皮擦当前命中的最上层 line 节点。
 *
 * rootIds / childrenIds 的后一个节点视觉上更靠上，所以这里从后往前遍历。
 * group 只作为层级容器，命中会递归 childrenIds；rect / ellipse / text 等图形直接跳过。
 * offset 累加父级位移，把组内局部节点换算到画板全局坐标。
 */
export const findHitNode = (
  page: CanvasPage,
  ids: string[],
  point: CanvasPoint,
  radius: number,
  offset: CanvasPoint = { x: 0, y: 0 },
): HitNodeResult | undefined => {
  // 从后往前找，保证视觉上更靠上的节点优先被橡皮擦命中。
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    const node = page.nodeMap[ids[index]];

    if (!node) continue;

    // group 只是层级容器，实际命中继续递归到它的子节点。
    if (node.kind === "group") {
      const childHit = findHitNode(page, node.childrenIds, point, radius, {
        x: offset.x + node.x,
        y: offset.y + node.y,
      });

      if (childHit) return childHit;
    }

    // 橡皮擦只擦画笔线：按路径距离命中。rect / ellipse / text 等图形不参与擦除。
    if (node.kind === "line") {
      if (isPointNearLineNode(node, point, radius, offset)) return { id: node.id, offset };
    }
  }

  return undefined;
};

/**
 * 把画板全局坐标转换成某条 line 节点内部坐标。
 *
 * eraserPaths 存在 LineNode 上，points 必须是相对 line 自身左上角的局部坐标。
 * parentOffset 用来扣掉 group 嵌套带来的父级位移。
 */
export const getLineLocalPoint = (
  node: LineNode,
  point: CanvasPoint,
  parentOffset: CanvasPoint,
) => ({
  x: point.x - parentOffset.x - node.x,
  y: point.y - parentOffset.y - node.y,
});

/**
 * 用实时预览状态把全局鼠标点转换成 line 内部坐标。
 *
 * preview 已经缓存了 nodeX / nodeY / parentOffset，pointermove 时不必再次查 store。
 * 这样实时擦除只更新临时 Line 的 points，避免频繁读写业务状态。
 */
export const getPreviewLocalPoint = (preview: LineEraserPreview, point: CanvasPoint) => ({
  x: point.x - preview.parentOffset.x - preview.nodeX,
  y: point.y - preview.parentOffset.y - preview.nodeY,
});
