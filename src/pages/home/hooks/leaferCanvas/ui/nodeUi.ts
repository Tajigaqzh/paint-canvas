import { Ellipse, Group, Polygon, Rect, Star, Text, type IUI } from "leafer-ui";
import type { CanvasNode } from "@/types";
import { syncLineGroupContent } from "./lineUi";
import { getNodePaintInput } from "./paint";
import type { ManagedNodeUI, NodeUIInput } from "../shared/types";

/**
 * 将 store 中的可序列化节点转换为 Leafer UI 可直接 set / new 的属性。
 *
 * 这个方法只做“业务字段 -> Leafer 字段”的纯映射，不创建 UI，也不写 store。
 * 每种 kind 都在这里收敛自己的尺寸、文本、角度、points 等差异字段。
 */
export const getNodeUIInput = (node: CanvasNode): NodeUIInput => {
  // 所有画布节点都允许选择和拖拽；非 select 工具会在 pointerdown 阶段拦截。
  const baseInput = {
    draggable: true,
    editable: true,
    ...getNodePaintInput(node),
    origin: node.transformOrigin ?? "center",
    rotation: node.rotation ?? 0,
    x: node.x,
    y: node.y,
  };

  // group 本身有包围盒和变换属性，子节点由 childrenIds 递归挂载。
  if (node.kind === "group") {
    return {
      ...baseInput,
      height: node.height,
      width: node.width,
    };
  }

  // 椭圆族包含圆、椭圆、圆环、扇形、弧线等，额外属性都映射给 Leafer Ellipse。
  if (node.kind === "ellipse") {
    return {
      ...baseInput,
      closed: node.closed,
      cornerRadius: node.cornerRadius,
      endAngle: node.endAngle,
      height: node.height,
      innerRadius: node.innerRadius,
      startAngle: node.startAngle,
      width: node.width,
    };
  }

  // 文本节点没有业务 width / height，位置和文本样式直接交给 Leafer Text。
  if (node.kind === "text") {
    return {
      ...baseInput,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      text: node.text,
    };
  }

  // line 在 Leafer 中用 Group 承载，points 会放到内部真实 Line 上。
  if (node.kind === "line") {
    return {
      ...baseInput,
      dashPattern: undefined,
      fill: "transparent",
      height: node.height,
      stroke: undefined,
      strokeWidth: 0,
      width: node.width,
    };
  }

  // 多边形使用 sides 和 cornerRadius 控制形态。
  if (node.kind === "polygon") {
    return {
      ...baseInput,
      cornerRadius: node.cornerRadius,
      height: node.height,
      sides: node.sides,
      width: node.width,
    };
  }

  // 星形使用 corners / innerRadius / startAngle 控制形态。
  if (node.kind === "star") {
    return {
      ...baseInput,
      cornerRadius: node.cornerRadius,
      corners: node.corners,
      height: node.height,
      innerRadius: node.innerRadius,
      startAngle: node.startAngle,
      width: node.width,
    };
  }

  // 剩余节点类型是矩形，支持宽高和圆角。
  return {
    ...baseInput,
    cornerRadius: node.cornerRadius,
    height: node.height,
    width: node.width,
  };
};

/**
 * 按节点类型创建对应的 Leafer UI 实例。
 *
 * 这个方法只在新增节点或 kind 变化时调用；同一个 nodeId 的 kind 不变时，
 * 后续会复用旧 UI 并调用 set() 增量更新，避免拖拽、编辑、图层变化导致整画布重建。
 */
export const createNodeUI = (node: CanvasNode): ManagedNodeUI | null => {
  // group 是唯一可能继续承载子节点的业务节点，因此创建为 Leafer Group。
  if (node.kind === "group") {
    return new Group(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 椭圆族统一由 Leafer Ellipse 表达。
  if (node.kind === "ellipse") {
    return new Ellipse(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 文本节点由 Leafer Text 表达，并交给 @leafer-in/text-editor 做双击编辑。
  if (node.kind === "text") {
    return new Text(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 自由线条和普通线条用 Group 表达：原线条 + 同组 eraser 轨迹。
  if (node.kind === "line") {
    const group = new Group(getNodeUIInput(node)) as ManagedNodeUI;

    syncLineGroupContent(group, node);

    return group;
  }

  // 三角形和多边形都由 Leafer Polygon 表达。
  if (node.kind === "polygon") {
    return new Polygon(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 星形节点由 Leafer Star 表达。
  if (node.kind === "star") {
    return new Star(getNodeUIInput(node)) as ManagedNodeUI;
  }

  // 当前剩余节点只可能是 rect。
  return new Rect(getNodeUIInput(node)) as ManagedNodeUI;
};

/**
 * 从 Leafer UI 反向读取可写回 store 的变换 patch。
 *
 * Leafer 拖拽和编辑会先改变运行时 UI 实例，store 不会自动更新。
 * 拖拽结束或编辑完成后用这个方法提取 x / y / width / height / rotation 等字段，
 * 再交给 canvasStore 形成一次可撤销的业务更新。
 */
export const getNodePatchFromUI = (ui: IUI, node: CanvasNode) => {
  // 文本节点尺寸由文本内容和字体决定，这里只同步位置和旋转。
  if (node.kind === "text") {
    return {
      rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
      x: Math.round(ui.x ?? node.x),
      y: Math.round(ui.y ?? node.y),
    };
  }

  // 普通图形需要同步位置、尺寸和旋转；Math.round 避免拖拽产生长小数污染 store。
  const patch = {
    height: Math.round(ui.height ?? node.height),
    rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
    width: Math.round(ui.width ?? node.width),
    x: Math.round(ui.x ?? node.x),
    y: Math.round(ui.y ?? node.y),
  };

  // 线条编辑可能改动局部 points，需要额外同步一份数组。
  if (node.kind === "line") {
    const lineUI = ui as IUI & { points?: number[] };

    if (lineUI.points?.length) {
      return {
        ...patch,
        points: [...lineUI.points],
      };
    }
  }

  return patch;
};

/**
 * 判断本次 UI 反读是否真的改变了节点字段。
 *
 * Leafer 的 DragEvent.END 可能在没有实际变更时触发；如果 patch 和 store 完全一致，
 * 就跳过提交，避免撤销历史里出现用户感知不到的空操作。
 */
export const hasNodePatchChange = (node: CanvasNode, patch: Partial<CanvasNode>) =>
  Object.entries(patch).some(
    ([key, value]) => (node as unknown as Record<string, unknown>)[key] !== value,
  );
