import type { CanvasNode } from "@/types";
import { strokeCurrentPath } from "./context";
import type { RenderContext } from "./types";

type LineNode = Extract<CanvasNode, { kind: "line" }>;

/**
 * 对开放路径执行描边。
 * 线条和开放弧线只需要 stroke，不需要 fill。
 */
const strokeOpenPath = (context: RenderContext, node: CanvasNode) => {
  strokeCurrentPath(context, node);
};

/**
 * 绘制 Leafer Line 对应的直线或曲线。
 * 有 points 时使用 points；没有 points 时按 Leafer 源码画从 (0,0) 到 (width,0) 的直线。
 *
 * 原理：
 * Leafer 的 Line 不是用一个独立控制点画曲线。
 * 它先读取 points 形成折线，再用 curve 参数把折线的每个中间点平滑成贝塞尔曲线。
 * 所以缩略图要复刻 Leafer 的 points 平滑算法，不能用一个简单 quadraticCurveTo 近似。
 */
/** 构造 line 的当前路径；原始笔迹和橡皮擦轨迹都复用这一套折线/曲线逻辑。 */
const renderLinePath = (
  context: RenderContext,
  points: number[],
  curve: LineNode["curve"],
) => {
  context.beginPath();
  context.moveTo(points[0] ?? 0, points[1] ?? 0);

  /**
   * 这里复刻 leafer-ui@2.2.3 的 BezierHelper.points 算法。
   * curve=true 时等价于 0.5；curve=数字时直接把这个数字作为曲率。
   *
   * 原理：
   * 对每个中间点 b，取前一个点 a 和后一个点 c。
   * ba 是 a->b 的距离，cb 是 b->c 的距离。
   * 曲率 curve 会按 ba / (ba + cb)、cb / (ba + cb) 分摊到 b 两侧，
   * 从而得到进入 b 的控制点 c1，以及离开 b 的控制点 c2。
   * 这样相邻线段越长，控制柄越长，曲线过渡就会更自然。
   */
  if (curve && points.length > 5) {
    const curveValue = curve === true ? 0.5 : curve;
    let c2X = points[0] ?? 0;
    let c2Y = points[1] ?? 0;
    let hasCurveSegment = false;

    for (let index = 2; index < points.length - 2; index += 2) {
      const aX = points[index - 2] ?? 0;
      const aY = points[index - 1] ?? 0;
      const bX = points[index] ?? 0;
      const bY = points[index + 1] ?? 0;
      let cX = points[index + 2] ?? 0;
      let cY = points[index + 3] ?? 0;
      const baX = bX - aX;
      const baY = bY - aY;
      let ba = Math.sqrt(baX ** 2 + baY ** 2);
      let cb = Math.sqrt((cX - bX) ** 2 + (cY - bY) ** 2);

      if (!ba && !cb) continue;

      const distance = ba + cb;

      ba = (curveValue * ba) / distance;
      cb = (curveValue * cb) / distance;
      cX -= aX;
      cY -= aY;

      /**
       * c1 是进入当前点 b 的控制点。
       * c2 是离开当前点 b 的控制点，会留到下一段三次贝塞尔曲线使用。
       */
      const c1X = bX - ba * cX;
      const c1Y = bY - ba * cY;

      /**
       * 开放曲线的第一段在 Leafer 中用二次曲线连接到第一个中间点。
       * 后续中间段用三次贝塞尔曲线连接，才能和主画布形状保持一致。
       */
      if (index === 2) {
        context.quadraticCurveTo(c1X, c1Y, bX, bY);
      } else if (baX || baY) {
        context.bezierCurveTo(c2X, c2Y, c1X, c1Y, bX, bY);
      }

      c2X = bX + cb * cX;
      c2Y = bY + cb * cY;
      hasCurveSegment = true;
    }

    /**
     * 开放曲线的最后一段也使用二次曲线收尾。
     * 这和 Leafer 源码里的最后一次 Q 命令对应。
     */
    if (hasCurveSegment) {
      context.quadraticCurveTo(
        c2X,
        c2Y,
        points[points.length - 2] ?? 0,
        points[points.length - 1] ?? 0,
      );
    }
  } else {
    for (let index = 2; index < points.length; index += 2) {
      context.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
    }
  }
};

/**
 * 计算 line 和 eraser 轨迹共同需要的局部绘制范围。
 * 不能直接使用 node.width / height，因为描边半宽和用户拖出线条外的 eraser 路径都可能超出节点包围盒。
 */
const getLineRenderBounds = (node: LineNode) => {
  const points = node.points?.length ? node.points : [0, 0, node.width, 0];
  let minX = 0;
  let minY = 0;
  let maxX = node.width;
  let maxY = node.height;
  const expandByPoint = (x: number, y: number, padding: number) => {
    minX = Math.min(minX, x - padding);
    minY = Math.min(minY, y - padding);
    maxX = Math.max(maxX, x + padding);
    maxY = Math.max(maxY, y + padding);
  };

  for (let index = 0; index < points.length; index += 2) {
    expandByPoint(
      points[index] ?? 0,
      points[index + 1] ?? 0,
      Math.max(node.strokeWidth ?? 0, 0) / 2,
    );
  }

  node.eraserPaths?.forEach((eraserPath) => {
    const padding = Math.max(eraserPath.strokeWidth, 0) / 2;

    for (let index = 0; index < eraserPath.points.length; index += 2) {
      expandByPoint(eraserPath.points[index] ?? 0, eraserPath.points[index + 1] ?? 0, padding);
    }
  });

  // 额外 2px 留给抗锯齿和小数坐标，避免离屏层边缘裁掉半透明像素。
  minX = Math.floor(minX - 2);
  minY = Math.floor(minY - 2);
  maxX = Math.ceil(maxX + 2);
  maxY = Math.ceil(maxY + 2);

  return {
    height: Math.max(maxY - minY, 1),
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
  };
};

/**
 * 在透明离屏层里绘制一条 line，并只在这条 line 的像素上应用 eraserPaths。
 * 这样 destination-out 不会碰到主缩略图里的白色画板背景，避免出现灰色透明轨迹。
 */
export const renderLineNode = (context: RenderContext, node: LineNode) => {
  const eraserPaths = node.eraserPaths ?? [];
  const bounds = getLineRenderBounds(node);
  const points = node.points?.length ? node.points : [0, 0, node.width, 0];

  if (eraserPaths.length === 0) {
    renderLinePath(context, points, node.curve);
    strokeOpenPath(context, node);
    return;
  }

  const layer = new OffscreenCanvas(bounds.width, bounds.height);
  const layerContext = layer.getContext("2d");

  if (!layerContext) return;

  layerContext.translate(-bounds.minX, -bounds.minY);
  renderLinePath(layerContext, points, node.curve);
  strokeOpenPath(layerContext, node);

  layerContext.save();
  layerContext.globalCompositeOperation = "destination-out";
  eraserPaths.forEach((eraserPath) => {
    if (eraserPath.points.length < 2 || eraserPath.strokeWidth <= 0) return;

    renderLinePath(layerContext, eraserPath.points, false);
    strokeCurrentPath(layerContext, {
      stroke: "#000000",
      strokeCap: "round",
      strokeStyle: "solid",
      strokeWidth: eraserPath.strokeWidth,
    });
  });
  layerContext.restore();

  context.drawImage(layer, bounds.minX, bounds.minY);
};
