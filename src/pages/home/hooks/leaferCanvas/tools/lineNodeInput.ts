import type { BrushDrawEvent } from "leafer-x-brush-eraser";
import type { LineNode } from "@/types";

/**
 * 把插件抛出的笔迹事件转成 store 的 line 节点输入。
 *
 * 插件只负责几何和描边（外接矩形 + 局部点 + 描边），
 * 节点类型、动画、描边风格这些业务字段由制作页补上。
 */
export const getLineNodeInput = (event: BrushDrawEvent): Omit<LineNode, "id" | "name"> => ({
  animationList: [],
  curve: 0.2,
  fill: "transparent",
  height: event.height,
  kind: "line",
  points: event.points,
  rotation: 0,
  stroke: event.stroke,
  strokeCap: "round",
  strokeStyle: "solid",
  strokeWidth: event.strokeWidth,
  transformOrigin: "top-left",
  width: event.width,
  x: event.x,
  y: event.y,
});
