import type { CanvasNode } from "@/types";
import { degreesToRadians } from "./context";
import type { RenderContext } from "./types";

/**
 * 绘制正多边形路径。
 * 三角形也是 polygon，只是 sides=3。
 *
 * 原理：
 * 把图形中心作为圆心，外接椭圆半径为 width/2 和 height/2。
 * 每个顶点按 360 / sides 均分角度，用 cos / sin 算出顶点坐标，再依次 lineTo 连接。
 */
export const renderRegularPolygonPath = (
  context: RenderContext,
  width: number,
  height: number,
  sides: number,
  startAngle = -90,
) => {
  const count = Math.max(3, Math.round(sides));
  const radiusX = width / 2;
  const radiusY = height / 2;
  const centerX = radiusX;
  const centerY = radiusY;

  context.beginPath();

  for (let index = 0; index < count; index += 1) {
    const angle = degreesToRadians(startAngle + (360 / count) * index);
    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
};

/**
 * 绘制星形路径。
 * 每个角会生成外点和内点两个顶点，因此循环次数是 corners * 2。
 *
 * 原理：
 * 星形可以看成外半径点和内半径点交替连接的多边形。
 * 偶数索引用外半径，奇数索引用 innerRadius 缩放后的内半径。
 * 每一步角度增加 180 / corners，这样一外一内交替后正好绕完整一圈。
 */
export const renderStarPath = (
  context: RenderContext,
  node: Extract<CanvasNode, { kind: "star" }>,
) => {
  const corners = Math.max(3, Math.round(node.corners));
  const innerRadius = Math.max(0.1, Math.min(node.innerRadius ?? 0.45, 0.9));
  const radiusX = node.width / 2;
  const radiusY = node.height / 2;
  const centerX = radiusX;
  const centerY = radiusY;

  context.beginPath();

  for (let index = 0; index < corners * 2; index += 1) {
    const radiusScale = index % 2 === 0 ? 1 : innerRadius;
    const angle = degreesToRadians((node.startAngle ?? -90) + (180 / corners) * index);
    const x = centerX + Math.cos(angle) * radiusX * radiusScale;
    const y = centerY + Math.sin(angle) * radiusY * radiusScale;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
};
