import type { LineNode } from "@/types";

/**
 * 把 brush 采样到的全局画板点归一化成一个 LineNode 输入。
 *
 * 画笔拖动时记录的是画板全局坐标；真正入 store 时需要转成：
 * 1. node.x / node.y = 所有点的外接矩形左上角。
 * 2. node.width / node.height = 外接矩形尺寸。
 * 3. node.points = 相对 node.x / node.y 的局部点。
 *
 * 这样后续拖拽整条线时只改 node.x / node.y，不需要重写每一个 points。
 */
export const getNormalizedLineNodeInput = (
  points: number[],
  strokeWidth: number,
): Omit<LineNode, "id" | "name"> | undefined => {
  // 少于一个点对时不能形成线。
  if (points.length < 2) return undefined;

  // 只有一个采样点时补一个极短线段，让 Leafer 能正常渲染。
  if (points.length === 2) {
    points.push(points[0] + 0.1, points[1] + 0.1);
  }

  // 计算采样点外接矩形，把全局点转换成 line 节点内部局部 points。
  const xValues = points.filter((_, index) => index % 2 === 0);
  const yValues = points.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);
  const localPoints = points.map((value, index) => (index % 2 === 0 ? value - minX : value - minY));

  // line 节点的 x/y 是外接矩形左上角，points 是相对这个左上角的局部坐标。
  return {
    animationList: [],
    curve: 0.2,
    fill: "transparent",
    height: Math.max(maxY - minY, 1),
    kind: "line",
    points: localPoints,
    rotation: 0,
    stroke: "#111827",
    strokeCap: "round",
    strokeStyle: "solid",
    strokeWidth,
    transformOrigin: "top-left",
    width: Math.max(maxX - minX, 1),
    x: minX,
    y: minY,
  };
};
