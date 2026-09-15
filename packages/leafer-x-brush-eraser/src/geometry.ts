import type { IPointData } from "@leafer-ui/interface";

/** 归一化后的笔迹几何：外接矩形 + 相对矩形左上角的点序列。 */
export type NormalizedLinePoints = {
  height: number;
  points: number[];
  width: number;
  x: number;
  y: number;
};

/**
 * 计算两个点之间的欧氏距离。
 *
 * 采样时用它做节流：距离太近的点不写入，减少路径点数量和重绘压力。
 */
export const getPointDistance = (left: IPointData, right: IPointData) =>
  Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2);

/**
 * 把容器局部坐标的采样点归一化成一段线几何。
 *
 * 采样点是容器坐标；输出的是「外接矩形左上角 + 相对左上角的局部点」，
 * 这样宿主之后拖拽整条笔迹时只改 x / y，不需要重写每一个点。
 * 返回 undefined 表示点数不够，不足以形成笔迹。
 */
export const normalizeLinePoints = (points: number[]): NormalizedLinePoints | undefined => {
  // 少于一个点对时不能形成线。
  if (points.length < 2) return undefined;

  const source = [...points];

  // 只有一个采样点时补一个极短线段，让 Leafer 能正常渲染。
  if (source.length === 2) source.push(source[0] + 0.1, source[1] + 0.1);

  const xValues = source.filter((_, index) => index % 2 === 0);
  const yValues = source.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  return {
    height: Math.max(maxY - minY, 1),
    points: source.map((value, index) => (index % 2 === 0 ? value - minX : value - minY)),
    width: Math.max(maxX - minX, 1),
    x: minX,
    y: minY,
  };
};

/**
 * 单个点的路径补成极短线段。
 *
 * 只有一对坐标时 Leafer 画不出东西，擦除轨迹也会失效，所以补 0.1 的偏移。
 */
export const padSinglePoint = (points: number[]) =>
  points.length === 2 ? [points[0], points[1], points[0] + 0.1, points[1] + 0.1] : points;
