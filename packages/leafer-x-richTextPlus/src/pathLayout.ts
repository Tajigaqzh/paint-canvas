import type {
  IPathAnchor,
  IPathPoint,
  ITextPathAlign,
  ITextPathDirection,
  ITextPathSide,
} from "./types";

export interface IPathSample extends IPathPoint {
  distance: number;
  angle: number;
}

export interface IPathGlyphLayout extends IPathSample {
  index: number;
  rotation: number;
}

/** 将多边形边数规范到 3～128 的整数；非法值回退为 3。 */
export const normalizePolygonSides = (sides: number): number => {
  if (!Number.isFinite(sides)) return 3;
  return Math.max(3, Math.min(128, Math.floor(sides)));
};

/** 更新指定锚点或控制手柄的位置，返回新的锚点数组（不修改原数组）。 */
export const movePathAnchor = (
  anchors: IPathAnchor[],
  index: number,
  handle: "anchor" | "in" | "out",
  x: number,
  y: number,
): IPathAnchor[] => {
  const anchor = anchors[index];
  if (!anchor) return anchors;

  const next = [...anchors];
  if (handle === "anchor") {
    next[index] = { ...anchor, x, y };
  } else {
    // 将 handle 的 "in" / "out" 映射为对应的控制手柄字段名
    const key: "handleIn" | "handleOut" = handle === "in" ? "handleIn" : "handleOut";
    next[index] = { ...anchor, [key]: { x: x - anchor.x, y: y - anchor.y } };
  }
  return next;
};

/** 计算路径点的包围盒，并根据 padding 向外扩展。 */
export const getPathBounds = (points: IPathPoint[], padding: number) => {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/** 把圆形文字的视觉锚点角度换算为完整圆路径的采样起点。 */
export const resolveCirclePathStartAngle = (anchorAngle: number, align: ITextPathAlign) =>
  align === "center" ? anchorAngle - 180 : anchorAngle;

/**
 * 生成以节点原点为中心的正多边形路径锚点。
 *
 * 多边形边数会先经 normalizePolygonSides 规范到 3～128 的整数；
 * 半径小于 1 时按 1 处理。每个锚点按等分角度分布在圆周上：
 * angle = startAngle + index * 360 / sideCount，再转换为弧度后
 * 计算 (radius·cos(angle), radius·sin(angle))。
 *
 * 返回的锚点仅包含坐标，不设置 handleIn / handleOut，因此各边默认
 * 为直线；锚点顺序沿角度递增方向排列，可用于后续路径采样与排版。
 *
 * @param sides 多边形边数，非法值回退为 3，最终限制在 3～128
 * @param radius 外接圆半径，小于 1 时按 1 处理
 * @param startAngle 第一个锚点的起始角度，单位为度，默认 -90
 * @returns 以节点原点为中心、按角度顺序排列的正多边形锚点数组
 */
export const createRegularPolygonPath = (
  sides: number,
  radius: number,
  startAngle = -90,
): IPathAnchor[] => {
  const sideCount = normalizePolygonSides(sides);
  const safeRadius = Math.max(1, radius);
  return Array.from({ length: sideCount }, (_, index) => {
    const angle = ((startAngle + (index * 360) / sideCount) * Math.PI) / 180;
    return {
      x: safeRadius * Math.cos(angle),
      y: safeRadius * Math.sin(angle),
    };
  });
};

const distance = (a: IPathPoint, b: IPathPoint) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * 计算三次贝塞尔曲线上参数 t（0～1）处的点坐标。
 *
 * 三次贝塞尔曲线的参数方程为：
 * B(t) = (1-t)³·p0 + 3(1-t)²t·p1 + 3(1-t)t²·p2 + t³·p3
 *
 * - p0 / p3：起点与终点锚点；
 * - p1 / p2：由起点 handleOut、终点 handleIn 推算出的控制点；
 * - t：0 返回 p0，1 返回 p3，中间值返回曲线上的插值点。
 *
 * @param p0 起点
 * @param p1 起点侧控制点
 * @param p2 终点侧控制点
 * @param p3 终点
 * @param t  曲线参数，通常取 [0, 1]
 */
const cubicPoint = (p0: IPathPoint, p1: IPathPoint, p2: IPathPoint, p3: IPathPoint, t: number) => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
};

const controlPoint = (anchor: IPathAnchor, handle: IPathPoint | undefined): IPathPoint => ({
  x: anchor.x + (handle?.x ?? 0),
  y: anchor.y + (handle?.y ?? 0),
});

const appendSample = (samples: IPathSample[], point: IPathPoint) => {
  const previous = samples.at(-1);
  const nextDistance = previous ? previous.distance + distance(previous, point) : 0;
  samples.push({ ...point, distance: nextDistance, angle: previous?.angle ?? 0 });
  if (previous) previous.angle = Math.atan2(point.y - previous.y, point.x - previous.x);
};

/** 将锚点路径采样成带累计长度和切线角度的折线。 */
/**
 * 将锚点路径采样成带累计长度和切线角度的折线（IPathSample 数组）。
 *
 * 采样流程：
 * 1. 先把首锚点作为第 0 个采样点写入，其 distance 为 0；
 * 2. 逐段遍历 anchors：from = anchors[index]，to = anchors[(index + 1) % anchors.length]；
 *    - 控制点 c1 / c2 由 from.handleOut 与 to.handleIn 相对锚点偏移换算得到（controlPoint）；
 *    - 该段任一端存在控制手柄则视为曲线段，按 Math.max(4, stepsPerSegment) 细分，
 *      否则视为直线段，只走 1 步（仅追加终点，避免直线产生冗余采样点）；
 *    - 每个细分点通过 cubicPoint 按三次贝塞尔公式插值；
 * 3. 每追加一个采样点，appendSample 会把当前点与前一点的欧氏距离累加到 distance 上，
 *    同时把前一点的 angle 更新为指向当前点的切线角度；
 * 4. 采样结束后，把最后一个点的 angle 修正为与前一个点一致，避免末段切线角度异常。
 *
 * 说明：closed 为 true 时会额外生成「末锚点 → 首锚点」的收尾段；
 * 当锚点均未设置 handleIn / handleOut 时，所有段都会退化为直线段。
 *
 * @param anchors 路径锚点数组；为空时直接返回空数组
 * @param closed 是否闭合路径，true 时补上末点回到首点的收尾段
 * @param stepsPerSegment 曲线段每段的细分步数，曲线段至少取 4 步，默认 32
 * @returns 采样点数组，按路径顺序排列，每项包含坐标、累计距离 distance 与切线角度 angle
 */
export const sampleBezierPath = (
  anchors: IPathAnchor[],
  closed = false,
  stepsPerSegment = 32,
): IPathSample[] => {
  if (!anchors.length) return [];
  const samples: IPathSample[] = [];
  appendSample(samples, anchors[0]);
  const segmentCount = closed ? anchors.length : anchors.length - 1;
  for (let index = 0; index < segmentCount; index++) {
    const from = anchors[index];
    const to = anchors[(index + 1) % anchors.length];
    const c1 = controlPoint(from, from.handleOut);
    const c2 = controlPoint(to, to.handleIn);
    const curved = !!from.handleOut || !!to.handleIn;
    const steps = curved ? Math.max(4, stepsPerSegment) : 1;
    for (let step = 1; step <= steps; step++) {
      appendSample(samples, cubicPoint(from, c1, c2, to, step / steps));
    }
  }
  if (samples.length > 1) samples.at(-1)!.angle = samples.at(-2)!.angle;
  return samples;
};

/**
 * 生成圆形路径的采样点数组。
 *
 * 圆形路径通过把圆按等角度切分为 `steps` 条弦来近似：以对象原点为圆心，
 * 从 `startAngle`（单位：度）开始，每隔 360/steps 度生成一个锚点，
 * 坐标为 (radius·cos(angle), radius·sin(angle))。
 * 随后把这些锚点交给 sampleBezierPath 以闭合路径方式采样：
 * 由于锚点未设置 handleIn / handleOut，各段均退化为直线段，
 * 因此最终得到的是内接于圆的正 `steps` 边形折线。
 *
 * 半径经 safeRadius 兜底，小于 1 时按 1 处理，避免生成退化路径；
 * `steps` 越大，折线越接近真实圆形，切线角度也更平滑。
 *
 * @param radius 圆的半径，小于 1 时按 1 处理
 * @param startAngle 起始角度，单位为度，默认 -90（即从正上方开始）
 * @param steps 圆周等分份数，也就是锚点数量，默认 256
 * @returns 闭合圆形路径的采样点数组，每项包含坐标、累计距离 distance 与切线角度 angle
 */
export const sampleCirclePath = (radius: number, startAngle = -90, steps = 256): IPathSample[] => {
  const safeRadius = Math.max(1, radius);
  const anchors: IPathAnchor[] = [];
  for (let index = 0; index < steps; index++) {
    const angle = ((startAngle + (index * 360) / steps) * Math.PI) / 180;
    anchors.push({
      x: safeRadius * Math.cos(angle),
      y: safeRadius * Math.sin(angle),
    });
  }
  return sampleBezierPath(anchors, true, 1);
};

/**
 * 根据累计路径距离 `target` 在采样折线上获取对应点。
 *
 * 采样数组 `samples` 中每个点都带有从路径起点累计的 `distance`，
 * 因此本函数先读取末点的 `distance` 作为路径总长度，再分三种情况处理：
 * - `target < 0`：目标位于路径起点之前，使用首点切线角度向反方向外推；
 * - `target > total`：目标位于路径终点之后，使用末点切线角度向正方向外推；
 * - 其余情况：将 `target` 限制在 `[0, total]` 内，遍历相邻采样点所在区间，
 *   按距离比例做线性插值，并沿用左端点的切线角度 `angle`。
 *
 * 该函数用于按字符 advance 在路径上定位文字中心点；返回值始终包含
 * 坐标 `x`、`y`、累计距离 `distance` 与切线角度 `angle`。
 *
 * @param samples 由 sampleBezierPath / sampleCirclePath 生成的路径采样点
 * @param target 目标累计路径距离，允许小于 0 或大于总长度
 * @returns 目标距离处的路径点信息；samples 为空时返回全 0 的占位点
 */
export const pointAtPathDistance = (samples: IPathSample[], target: number): IPathSample => {
  if (!samples.length) return { x: 0, y: 0, distance: 0, angle: 0 };
  const total = samples.at(-1)!.distance;
  if (target < 0) {
    const first = samples[0];
    return {
      ...first,
      x: first.x + Math.cos(first.angle) * target,
      y: first.y + Math.sin(first.angle) * target,
      distance: target,
    };
  }
  if (target > total) {
    const last = samples.at(-1)!;
    const overflow = target - total;
    return {
      ...last,
      x: last.x + Math.cos(last.angle) * overflow,
      y: last.y + Math.sin(last.angle) * overflow,
      distance: target,
    };
  }
  const value = Math.max(0, Math.min(total, target));
  for (let index = 1; index < samples.length; index++) {
    const right = samples[index];
    if (right.distance < value) continue;
    const left = samples[index - 1];
    const span = Math.max(right.distance - left.distance, 1e-6);
    const ratio = (value - left.distance) / span;
    return {
      x: left.x + (right.x - left.x) * ratio,
      y: left.y + (right.y - left.y) * ratio,
      distance: value,
      angle: left.angle,
    };
  }
  return { ...samples.at(-1)! };
};

/**
 * 计算路径排版中某个字形对应的光标位置与旋转角度。
 *
 * 字形在路径上的中心距离记录在 `glyph.distance`（由 layoutGlyphsOnPath 生成，
 * reverse 时已换算为路径上的实际距离）。本函数在该中心点基础上偏移半个 advance，
 * 从而得到紧贴字形前缘（默认）或后缘（atEnd 为 true）的光标点：
 *
 * 1. 方向：`direction = reverse ? -1 : 1`。路径反向排版时，文字的阅读方向与
 *    路径距离的增长方向相反，因此所有沿阅读方向的偏移都要取负；
 * 2. 偏移量：`offset = ((atEnd ? 1 : -1) * direction * max(advance, 0)) / 2`。
 *    - atEnd 为 false（默认）：取字形前缘，即中心距离减去半个 advance；
 *    - atEnd 为 true：取字形后缘，即中心距离加上半个 advance；
 *    - advance 会先被夹到不小于 0，避免负宽度把光标推向字形另一侧；
 * 3. 定位：`pointAtPathDistance(samples, glyph.distance + offset)` 取对应路径点；
 *    当目标距离小于 0 或大于路径总长时，该函数会按首/末点的切线角线性外推，
 *    因此行首、行尾的光标不会塌陷到路径端点上；
 * 4. 角度：
 *    `textRotation = point.angle`
 *    `+ (reverse ? π : 0)`：反向排版时翻转 180°，让光标朝向与反向阅读方向一致；
 *    `+ (side === "inner" ? π : 0)`：内侧文字再翻转 180°，与字形朝向保持一致；
 *    `+ (options.rotation ?? 0)`：调用方追加的弧度旋转量，默认 0。
 *    最后减去 π/2，把「路径切线角」换算成「光标自身的绘制角度」，
 *    使光标始终垂直于路径（即垂直于文字基线）。
 *
 * 注意：本函数只读取 `glyph.distance`，不使用 glyph.index / glyph.rotation 等字段；
 * 返回值也仅包含位置与旋转角，不含 distance、index。
 *
 * @param samples 路径采样点数组，通常由 sampleBezierPath / sampleCirclePath 生成；
 *                为空时 pointAtPathDistance 会返回全 0 的占位点
 * @param glyph   目标字形的路径排版信息，使用其累计距离 distance 作为基准点
 * @param advance 该字形的步进宽度（一般取字体度量的 advance），决定光标距字形中心多远
 * @param options 可选配置：
 *   - atEnd：true 取字形后缘（文字末端），false / 省略取前缘（文字起点）
 *   - direction：路径文字方向，为 "reverse" 时沿路径反方向排版
 *   - side：文字位于路径内侧还是外侧，为 "inner" 时额外翻转 180°
 *   - rotation：附加旋转量，单位为弧度，默认 0，可用于整体微调光标角度
 * @returns 光标的位置与旋转角度 `{ x, y, rotation }`，rotation 为弧度制绘制角
 */
export const getPathCaret = (
  samples: IPathSample[],
  glyph: IPathGlyphLayout,
  advance: number,
  options: {
    atEnd?: boolean;
    direction?: ITextPathDirection;
    side?: ITextPathSide;
    rotation?: number;
  } = {},
) => {
  const reverse = options.direction === "reverse";
  const direction = reverse ? -1 : 1;
  const offset = ((options.atEnd ? 1 : -1) * direction * Math.max(0, advance)) / 2;
  const point = pointAtPathDistance(samples, glyph.distance + offset);
  const textRotation =
    point.angle +
    (reverse ? Math.PI : 0) +
    (options.side === "inner" ? Math.PI : 0) +
    (options.rotation ?? 0);
  return {
    x: point.x,
    y: point.y,
    rotation: textRotation - Math.PI / 2,
  };
};

/**
 * 把一串字形步进宽度（advances）沿路径排布，返回每个字形的路径布局信息。
 *
 * 排版流程：
 * 1. 路径总长度 `total` 取最后一个采样点的累计距离 `distance`；
 * 2. 文本总长度 `textLength` 为所有 advance 夹到非负后的累加和；
 * 3. 起点位置 `cursor` 由 align 决定：
 *    - "start"：0，文字从路径起点开始排；
 *    - "end"：total - textLength，让文字末尾贴齐路径终点（结果可能为负，
 *      此时首字会落在路径起点之前，由 pointAtPathDistance 做线性外推）；
 *    - "center"（默认）：(total - textLength) / 2，文字在整条路径上居中；
 * 4. 方向：direction 为 "reverse" 时，阅读方向与路径距离的增长方向相反，
 *    因此实际取点距离要换算成 `total - centerDistance`，同时切线角加 π，
 *    让字形朝向翻转，与反向阅读方向一致；
 * 5. 内外侧：side 为 "inner" 时整体再加 π，使文字面向路径内侧（默认外侧）；
 * 6. 逐字累加 cursor：每个字形以其中点 `advance / 2 + cursor` 作为定位距离，
 *    调用 pointAtPathDistance 取路径点，随后 `cursor += advance` 推进到下一字。
 *
 * 返回项的 `rotation` 为「切线角 + 反向修正 + 内侧修正」，即文字基线方向；
 * 而 getPathCaret 在此基础上再减 π/2，得到垂直于路径的光标绘制角度，
 * 二者互补：本函数负责字形沿路径的落位，光标函数负责文字起止端的定位。
 *
 * 说明：advance 会先夹到不小于 0，负宽度不会把光标往回推；
 * samples 为空时直接返回空数组；当文字总长度超出路径长度时，
 * pointAtPathDistance 会按首/末点的切线角做线性外推，
 * 因此字形不会被压缩堆叠到路径端点上。
 *
 * @param samples 路径采样点数组，通常由 sampleBezierPath / sampleCirclePath 生成
 * @param advances 每个字形的步进宽度（一般取字体度量的 advance），按文字顺序排列
 * @param options 可选配置：
 *   - align：文字在路径上的对齐方式，"start" / "center"（默认）/ "end"
 *   - direction：排版方向，"reverse" 时沿路径反方向排版
 *   - side：文字位于路径外侧（默认）还是内侧，"inner" 时整体翻转 180°
 * @returns 与 advances 等长的字形布局数组，每项包含路径点信息（x / y / distance / angle）、
 *          字形下标 index 与绘制角度 rotation
 */
export const layoutGlyphsOnPath = (
  samples: IPathSample[],
  advances: number[],
  options: {
    align?: ITextPathAlign;
    direction?: ITextPathDirection;
    side?: ITextPathSide;
  } = {},
): IPathGlyphLayout[] => {
  if (!samples.length) return [];
  const total = samples.at(-1)!.distance;
  const textLength = advances.reduce((sum, value) => sum + Math.max(0, value), 0);
  const align = options.align ?? "center";
  let cursor =
    align === "start" ? 0 : align === "end" ? total - textLength : (total - textLength) / 2;
  const reverse = options.direction === "reverse";
  const sideRotation = options.side === "inner" ? Math.PI : 0;
  return advances.map((advance, index) => {
    const centerDistance = Math.max(0, advance) / 2 + cursor;
    const pathDistance = reverse ? total - centerDistance : centerDistance;
    const point = pointAtPathDistance(samples, pathDistance);
    cursor += Math.max(0, advance);
    const tangent = point.angle + (reverse ? Math.PI : 0);
    return {
      ...point,
      index,
      rotation: tangent + sideRotation,
    };
  });
};
