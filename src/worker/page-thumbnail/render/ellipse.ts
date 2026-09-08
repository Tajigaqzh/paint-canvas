import type { CanvasNode } from "@/types";
import { degreesToRadians, strokeCurrentPath } from "./context";
import type { RenderContext } from "./types";

type EllipseNode = Extract<CanvasNode, { kind: "ellipse" }>;

/**
 * 对椭圆类路径执行填充和描边。
 * 弧线是开放路径，不应该填充；圆环需要传 evenodd 才能挖出内圈。
 *
 * 原理：
 * 普通图形直接 fill 当前路径。
 * 圆环由外圈路径和内圈反向路径组成，使用 evenodd 填充规则时，内圈会被判定为“洞”。
 * 开放弧线没有封闭区域，fill 没有明确意义，所以 closed=false 时跳过 fill。
 */
const fillAndStrokeEllipsePath = (
  context: RenderContext,
  node: EllipseNode,
  fillRule?: CanvasFillRule,
) => {
  context.fillStyle = node.fill ?? "transparent";

  if (node.closed !== false) {
    context.fill(fillRule);
  }

  strokeCurrentPath(context, node);
};

/**
 * 绘制 Leafer Ellipse 对应的多种形态。
 * 支持普通圆/椭圆、扇形、圆环、扇形圆环和开放弧线。
 *
 * 原理：
 * Canvas 2D 的 ellipse(cx, cy, rx, ry, rotation, start, end) 可以直接画椭圆弧。
 * 完整圆/椭圆就是 start=0、end=2π。
 * 扇形是在圆心 moveTo 后画外弧，再 closePath 回到圆心。
 * 圆环是在同一个路径里画外弧和内弧，再用 evenodd 填充挖空。
 */
export const renderEllipseNode = (context: RenderContext, node: EllipseNode) => {
  const radiusX = node.width / 2;
  const radiusY = node.height / 2;
  const centerX = radiusX;
  const centerY = radiusY;
  const startAngle = degreesToRadians(node.startAngle ?? 0);
  const endAngle = degreesToRadians(node.endAngle ?? 360);
  const innerRadius = Math.max(0, Math.min(node.innerRadius ?? 0, 0.95));

  context.beginPath();

  /**
   * closed=false 对应 Leafer 的开放弧线。
   * 这种模式只画椭圆弧，不闭合到圆心。
   */
  if (node.closed === false) {
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, startAngle, endAngle);
    fillAndStrokeEllipsePath(context, node);
    return;
  }

  /**
   * innerRadius > 0 时绘制圆环或扇形圆环。
   * 外圈顺时针、内圈反向绘制，再用 evenodd 填充规则挖空中间区域。
   */
  if (innerRadius > 0) {
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, startAngle, endAngle);
    context.ellipse(
      centerX,
      centerY,
      radiusX * innerRadius,
      radiusY * innerRadius,
      0,
      endAngle,
      startAngle,
      true,
    );
    context.closePath();
    fillAndStrokeEllipsePath(context, node, "evenodd");
    return;
  }

  /**
   * 只设置 startAngle / endAngle 且没有 innerRadius 时绘制普通扇形。
   * 路径从圆心开始，沿外弧走一圈后闭合回圆心。
   */
  if (node.startAngle !== undefined || node.endAngle !== undefined) {
    context.moveTo(centerX, centerY);
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, startAngle, endAngle);
    context.closePath();
    fillAndStrokeEllipsePath(context, node);
    return;
  }

  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  fillAndStrokeEllipsePath(context, node);
};
