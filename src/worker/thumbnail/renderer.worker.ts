import type { CanvasCornerRadius, CanvasNode, CanvasPage } from "@/types";
import type { ThumbnailWorkerRequest, ThumbnailWorkerResponse } from "./types";

type WorkerPort = {
  onmessage: ((event: MessageEvent<ThumbnailWorkerRequest>) => void) | null;
  postMessage(message: ThumbnailWorkerResponse, transfer?: Transferable[]): void;
};

const workerPort = self as unknown as WorkerPort;

type VisibleStrokeNode = CanvasNode & {
  stroke: string;
  strokeWidth: number;
};

/** worker 内绘制橡皮擦路径时临时使用的最小描边节点结构。 */
type EraserStrokeNode = {
  /** 橡皮擦路径在 destination-out 下只使用 alpha，具体颜色不影响结果。 */
  stroke: string;
  /** 橡皮擦端点保持 round，和主画布 Leafer eraser Line 一致。 */
  strokeCap?: CanvasNode["strokeCap"];
  /** 橡皮擦路径样式，当前始终为 solid。 */
  strokeStyle?: CanvasNode["strokeStyle"];
  /** 橡皮擦宽度。 */
  strokeWidth: number;
};

/**
 * 将节点上的圆角配置统一转换成四个角的数组。
 * 这里兼容 Leafer 的 1/2/3/4 值写法，返回顺序固定为：
 * 左上、右上、右下、左下。
 */
const getCornerRadiusValues = (cornerRadius: CanvasCornerRadius | undefined) => {
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
const withNodeTransform = (
  context: OffscreenCanvasRenderingContext2D,
  node: CanvasNode,
  render: () => void,
) => {
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
const renderRoundRect = (
  context: OffscreenCanvasRenderingContext2D,
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
const getStrokeDashPattern = (node: CanvasNode | EraserStrokeNode) => {
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
const hasVisibleStroke = (node: CanvasNode | EraserStrokeNode): node is VisibleStrokeNode =>
  Boolean(node.stroke && (node.strokeWidth ?? 0) > 0);

/**
 * 将 Leafer 风格的 strokeCap 转换为 Canvas 2D 的 lineCap。
 * 业务里的 none 对应 Canvas 里的 butt。
 */
const getCanvasLineCap = (node: CanvasNode | EraserStrokeNode): CanvasLineCap => {
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
const withStrokeStyle = (
  context: OffscreenCanvasRenderingContext2D,
  node: CanvasNode | EraserStrokeNode,
  render: () => void,
) => {
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
const strokeCurrentPath = (
  context: OffscreenCanvasRenderingContext2D,
  node: CanvasNode | EraserStrokeNode,
) => {
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
const fillAndStrokeNode = (context: OffscreenCanvasRenderingContext2D, node: CanvasNode) => {
  context.fillStyle = node.fill ?? "transparent";
  context.fill();

  strokeCurrentPath(context, node);
};

/**
 * 将角度转换成弧度。
 * Canvas 2D 的 ellipse / arc 使用弧度，Leafer 和属性面板里使用角度。
 */
const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

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
  context: OffscreenCanvasRenderingContext2D,
  node: Extract<CanvasNode, { kind: "ellipse" }>,
  fillRule?: CanvasFillRule,
) => {
  context.fillStyle = node.fill ?? "transparent";

  if (node.closed !== false) {
    context.fill(fillRule);
  }

  strokeCurrentPath(context, node);
};

/**
 * 对开放路径执行描边。
 * 线条和开放弧线只需要 stroke，不需要 fill。
 */
const strokeOpenPath = (context: OffscreenCanvasRenderingContext2D, node: CanvasNode) => {
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
const renderEllipseNode = (
  context: OffscreenCanvasRenderingContext2D,
  node: Extract<CanvasNode, { kind: "ellipse" }>,
) => {
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
  context: OffscreenCanvasRenderingContext2D,
  points: number[],
  curve: Extract<CanvasNode, { kind: "line" }>["curve"],
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
const getLineRenderBounds = (node: Extract<CanvasNode, { kind: "line" }>) => {
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
const renderLineNode = (
  context: OffscreenCanvasRenderingContext2D,
  node: Extract<CanvasNode, { kind: "line" }>,
) => {
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

/**
 * 绘制正多边形路径。
 * 三角形也是 polygon，只是 sides=3。
 *
 * 原理：
 * 把图形中心作为圆心，外接椭圆半径为 width/2 和 height/2。
 * 每个顶点按 360 / sides 均分角度，用 cos / sin 算出顶点坐标，再依次 lineTo 连接。
 */
const renderRegularPolygonPath = (
  context: OffscreenCanvasRenderingContext2D,
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
const renderStarPath = (
  context: OffscreenCanvasRenderingContext2D,
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

/**
 * 根据节点类型分发到对应的绘制函数。
 * group 会递归绘制 childrenIds，普通节点会先应用自身坐标和旋转。
 */
const renderNode = (
  page: CanvasPage,
  nodeId: string,
  context: OffscreenCanvasRenderingContext2D,
) => {
  const node = page.nodeMap[nodeId];

  if (!node) return;

  if (node.kind === "group") {
    withNodeTransform(context, node, () => {
      node.childrenIds.forEach((childId) => {
        renderNode(page, childId, context);
      });
    });
    return;
  }

  if (node.kind === "ellipse") {
    withNodeTransform(context, node, () => {
      renderEllipseNode(context, node);
    });
    return;
  }

  if (node.kind === "line") {
    withNodeTransform(context, node, () => {
      renderLineNode(context, node);
    });
    return;
  }

  if (node.kind === "polygon") {
    withNodeTransform(context, node, () => {
      renderRegularPolygonPath(context, node.width, node.height, node.sides);
      fillAndStrokeNode(context, node);
    });
    return;
  }

  if (node.kind === "star") {
    withNodeTransform(context, node, () => {
      renderStarPath(context, node);
      fillAndStrokeNode(context, node);
    });
    return;
  }

  if (node.kind === "text") {
    withNodeTransform(context, node, () => {
      context.fillStyle = node.fill ?? "#111827";
      context.font = `${node.fontWeight ?? 400} ${node.fontSize}px sans-serif`;
      context.textBaseline = "top";
      context.fillText(node.text, 0, 0);

      withStrokeStyle(context, node, () => {
        context.strokeText(node.text, 0, 0);
      });
    });
    return;
  }

  withNodeTransform(context, node, () => {
    renderRoundRect(context, node.width, node.height, getCornerRadiusValues(node.cornerRadius));
    fillAndStrokeNode(context, node);
  });
};

/**
 * 渲染整页缩略图并返回 ImageBitmap。
 * 缩略图只包含白色画布和画布内元素，外层灰色工作区背景不会参与绘制。
 *
 * 原理：
 * worker 内使用 OffscreenCanvas，不阻塞主线程。
 * 先按缩略图尺寸创建离屏画布，再把页面 viewport 等比缩放进去。
 * 绘制完成后 transferToImageBitmap()，把位图所有权转交给主线程显示。
 */
const renderPage = (page: CanvasPage, width: number, height: number) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器无法创建 OffscreenCanvas 2D 上下文");
  }

  const scale = Math.min(width / page.viewport.width, height / page.viewport.height);
  const boardX = Math.max((width - page.viewport.width * scale) / 2, 0);
  const boardY = Math.max((height - page.viewport.height * scale) / 2, 0);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.save();

  /**
   * 把 1920 x 1080 的画布按比例缩放到缩略图尺寸中。
   * boardX / boardY 用来让画布在缩略图容器中居中。
   */
  context.translate(boardX, boardY);
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.viewport.width, page.viewport.height);
  context.strokeStyle = "#d9dee8";
  context.lineWidth = 1 / scale;
  context.strokeRect(0, 0, page.viewport.width, page.viewport.height);
  context.beginPath();
  context.rect(0, 0, page.viewport.width, page.viewport.height);
  context.clip();
  page.rootIds.forEach((nodeId) => {
    renderNode(page, nodeId, context);
  });
  context.restore();

  return canvas.transferToImageBitmap();
};

/**
 * worker 的消息入口。
 * 主线程发送 render 请求后，这里渲染对应页面并把 ImageBitmap 转回主线程。
 */
workerPort.onmessage = (event) => {
  const { page, requestId, size, type } = event.data;

  if (type !== "render") return;

  try {
    const bitmap = renderPage(page, size.width, size.height);

    workerPort.postMessage(
      {
        bitmap,
        pageId: page.id,
        requestId,
        type: "rendered",
      },
      [bitmap],
    );
  } catch (error) {
    workerPort.postMessage({
      error: error instanceof Error ? error.message : String(error),
      pageId: page.id,
      requestId,
      type: "error",
    });
  }
};
