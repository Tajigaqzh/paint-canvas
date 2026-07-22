import type { CanvasNode } from "@/types";

/**
 * 将业务描边样式转换成 Leafer 可识别的 dashPattern。
 *
 * 业务节点只保存 strokeStyle 和 strokeWidth；Leafer 需要具体的虚线间隔数组。
 * 这里把 dashed / dotted 转成随线宽缩放的节奏，避免线越粗虚线看起来越密。
 */
export const getStrokeDashPattern = (node: CanvasNode) => {
  // strokeWidth <= 0 表示业务上没有可见描边，不需要虚线配置。
  const width = Math.max(node.strokeWidth ?? 0, 0);

  // solid 不传 dashPattern，让 Leafer 使用默认实线。
  if (width <= 0) return undefined;
  // dashed 的节奏随线宽放大，避免粗线时虚线太密。
  if (node.strokeStyle === "dashed") return [width * 4, width * 2];
  // dotted 用短实线段模拟圆点；端点形状由 strokeCap 决定。
  if (node.strokeStyle === "dotted") return [width, width * 2];

  return undefined;
};

/**
 * 抽出所有图形共用的填充和描边属性。
 *
 * 创建 UI 和后续增量 set 都会调用它，保证 fill / stroke / dashPattern 等样式
 * 在新增节点和更新节点时走同一套映射逻辑。
 */
export const getNodePaintInput = (node: CanvasNode) => ({
  dashPattern: getStrokeDashPattern(node),
  fill: node.fill,
  stroke: node.stroke,
  strokeAlign: node.strokeAlign,
  strokeCap: node.strokeCap,
  strokeWidth: node.strokeWidth,
});
