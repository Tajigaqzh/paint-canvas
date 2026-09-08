import type { CanvasCornerRadius, CanvasNode } from "@/types";
import type { EraserStrokeNode, RenderContext, StrokeNode, VisibleStrokeNode } from "./types";

/**
 * 将节点上的圆角配置统一转换成四个角的数组。
 * 这里兼容 Leafer 的 1/2/3/4 值写法，返回顺序固定为：
 * 左上、右上、右下、左下。
 */
export const getCornerRadiusValues = (cornerRadius: CanvasCornerRadius | undefined) => {
  if (Array.isArray(cornerRadius)) {
    const [topLeft = 0, topRight = topLeft, bottomRight = topLeft, bottomLeft = topRight] =
      cornerRadius;

    return [topLeft, topRight, bottomRight, bottomLeft];
  }

  const value = cornerRadius ?? 0;

  return [value, value, value, value];
};

/**
 * 根据节点的 transformOrigin 计算旋转基准点。
 * 缩略图是用 Canvas 2D 手动绘制的，所以要自己模拟 Leafer 的 origin 行为。
 */
const getOriginPoint = (node: CanvasNode) => {
  const width = "width" in node ? node.width : Math.max(node.text.length * node.fontSize, 1);
  const height = "height" in node ? node.height : node.fontSize;

  switch (node.transformOrigin) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top":
      return { x: width / 2, y: 0 };
    case "top-right":
      return { x: width, y: 0 };
    case "left":
      return { x: 0, y: height / 2 };
    case "right":
      return { x: width, y: height / 2 };
    case "bottom-left":
      return { x: 0, y: height };
    case "bottom":
      return { x: width / 2, y: height };
    case "bottom-right":
      return { x: width, y: height };
    case "center":
    default:
      return { x: width / 2, y: height / 2 };
  }
};

/**
 * 在节点自己的坐标系中执行绘制。
 * 先平移到节点位置和旋转基准点，再旋转，最后把坐标系移回节点左上角。
 *
 * 原理：
 * Canvas 2D 的 rotate() 永远围绕当前坐标系原点旋转。
 * 如果直接在 (0,0) 旋转，元素会绕页面左上角转，不是绕元素自身转。
 * 所以这里先把坐标系原点移动到“节点位置 + 节点旋转基准点”，
 * 再 rotate，最后 translate(-origin.x, -origin.y)，让后续绘制仍然按节点左上角写坐标。
 */
export const withNodeTransform = (context: RenderContext, node: CanvasNode, render: () => void) => {
  const origin = getOriginPoint(node);

  context.save();
  context.translate(node.x + origin.x, node.y + origin.y);
  context.rotate(((node.rotation ?? 0) * Math.PI) / 180);
  context.translate(-origin.x, -origin.y);
  render();
  context.restore();
};

/**
 * 绘制圆角矩形路径。
 * 这里只负责创建路径，不负责 fill / stroke，调用方决定最终外观。
 *
 * 原理：
 * 矩形的每条边使用 lineTo 绘制，拐角处使用 quadraticCurveTo 做二次贝塞尔过渡。
 * 圆角半径会被限制在宽/高的一半以内，避免圆角大于矩形尺寸后路径翻折。
 */
export const renderRoundRect = (
  context: RenderContext,
  width: number,
  height: number,
  radius: number[],
) => {
  const [topLeft, topRight, bottomRight, bottomLeft] = radius.map((value) =>
    Math.max(0, Math.min(value, width / 2, height / 2)),
  );

  context.beginPath();
  context.moveTo(topLeft, 0);
  context.lineTo(width - topRight, 0);
  context.quadraticCurveTo(width, 0, width, topRight);
  context.lineTo(width, height - bottomRight);
  context.quadraticCurveTo(width, height, width - bottomRight, height);
  context.lineTo(bottomLeft, height);
  context.quadraticCurveTo(0, height, 0, height - bottomLeft);
  context.lineTo(0, topLeft);
  context.quadraticCurveTo(0, 0, topLeft, 0);
  context.closePath();
};

/**
 * 将业务里的描边样式转换为 Canvas 2D 的虚线数组。
 * 返回空数组表示实线。
 */
const getStrokeDashPattern = (node: StrokeNode) => {
  const width = Math.max(node.strokeWidth ?? 0, 0);

  if (width <= 0) return [];
  if (node.strokeStyle === "dashed") return [width * 4, width * 2];
  if (node.strokeStyle === "dotted") return [width, width * 2];

  return [];
};

/**
 * 判断节点是否真的需要描边。
 * 只有 stroke 有颜色并且 strokeWidth 大于 0 时，Canvas 2D 才需要执行描边。
 */
const hasVisibleStroke = (node: StrokeNode): node is VisibleStrokeNode | EraserStrokeNode =>
  Boolean(node.stroke && (node.strokeWidth ?? 0) > 0);

/**
 * 将 Leafer 风格的 strokeCap 转换为 Canvas 2D 的 lineCap。
 * 业务里的 none 对应 Canvas 里的 butt。
 */
const getCanvasLineCap = (node: StrokeNode): CanvasLineCap => {
  if (node.strokeCap === "round") return "round";
  if (node.strokeCap === "square") return "square";

  return "butt";
};

/**
 * 临时应用节点描边样式，并在绘制完成后重置 Canvas 2D 的描边状态。
 *
 * 原理：
 * Canvas 2D 的 lineDash / lineCap / strokeStyle / lineWidth 都是上下文状态。
 * 如果画完一个节点后不重置，后面的节点会继承上一个节点的描边样式。
 */
export const withStrokeStyle = (context: RenderContext, node: StrokeNode, render: () => void) => {
  if (!hasVisibleStroke(node)) return;

  context.setLineDash(getStrokeDashPattern(node));
  context.lineCap = getCanvasLineCap(node);
  context.strokeStyle = node.stroke;
  context.lineWidth = node.strokeWidth;
  render();
  context.setLineDash([]);
  context.lineCap = "butt";
};

/**
 * 对当前路径执行描边。
 * 当前路径由调用方提前 beginPath 并构造好，这里只负责套用节点的描边外观。
 */
export const strokeCurrentPath = (context: RenderContext, node: StrokeNode) => {
  withStrokeStyle(context, node, () => {
    context.stroke();
  });
};

/**
 * 对闭合图形统一执行填充和描边。
 * 矩形、普通椭圆、多边形、星形等都走这套外观逻辑。
 *
 * 原理：
 * Canvas 2D 的 fill() / stroke() 都作用于当前路径。
 * 所以每个图形函数先 beginPath 并构造路径，这里再把 fill、dash、lineCap、strokeWidth 等外观应用上去。
 */
export const fillAndStrokeNode = (context: RenderContext, node: CanvasNode) => {
  context.fillStyle = node.fill ?? "transparent";
  context.fill();

  strokeCurrentPath(context, node);
};

/** 将角度转换成弧度。Canvas 2D 的 ellipse / arc 使用弧度，Leafer 和属性面板里使用角度。 */
export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
