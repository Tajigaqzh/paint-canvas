import "@leafer-in/animate";
import { Ellipse, Group, Image, Polygon, Rect, Star, Text, type IUI } from "leafer-ui";
import { CurvedText } from "leafer-x-curved-text";
import type { CanvasNode, ManagedNodeUI, NodeUIInput } from "@/types";
import { getLeaferAnimation } from "./animation";
import { getLineClassPrefix, syncLineGroupContent } from "./lineUi";
import { getNodePaintInput } from "./paint";

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

  if (node.kind === "curvedText") {
    return {
      ...baseInput,
      fill: node.defaultStyle.fill,
    };
  }

  // line 在 Leafer 中用 Group 承载，points 会放到内部真实 Line 上。
  if (node.kind === "line") {
    return {
      ...baseInput,
      className: getLineClassPrefix(node),
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

  // 图片节点只同步几何；远程 src 由 syncImageSource 换成 blob object URL。
  if (node.kind === "image") {
    return {
      ...baseInput,
      height: node.height,
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
  const input = getNodeUIInput(node);
  const animation = getLeaferAnimation(node.animationList);

  // 没有动画时不要带上 animation 字段。
  // Leafer 在 add() 时只要看到 this.animation 就会调 __runAnimation，空值也会误触发。
  if (animation) {
    input.animation = animation;
  }

  // group 是唯一可能继续承载子节点的业务节点，因此创建为 Leafer Group。
  if (node.kind === "group") {
    return new Group(input) as unknown as ManagedNodeUI;
  }

  // 椭圆族统一由 Leafer Ellipse 表达。
  if (node.kind === "ellipse") {
    return new Ellipse(input) as unknown as ManagedNodeUI;
  }

  // 文本节点由 Leafer Text 表达，并交给 @leafer-in/text-editor 做双击编辑。
  if (node.kind === "text") {
    return new Text(input) as unknown as ManagedNodeUI;
  }

  if (node.kind === "curvedText") {
    return new CurvedText({
      ...input,
      layout: node.layout,
      text: node.text,
      defaultStyle: node.defaultStyle,
      styleRuns: node.styleRuns,
      characterEditing: false,
    }) as unknown as ManagedNodeUI;
  }

  // 自由线条和普通线条用 Group 表达：原线条 + 同组 eraser 轨迹。
  if (node.kind === "line") {
    const group = new Group(input) as unknown as ManagedNodeUI;

    syncLineGroupContent(group, node);

    return group;
  }

  // 三角形和多边形都由 Leafer Polygon 表达。
  if (node.kind === "polygon") {
    return new Polygon(input) as unknown as ManagedNodeUI;
  }

  // 星形节点由 Leafer Star 表达。
  if (node.kind === "star") {
    return new Star(input) as unknown as ManagedNodeUI;
  }

  // 图片走 Leafer Image；远程 src 先换成 Blob，再 createObjectURL 赋给 url。
  if (node.kind === "image") {
    return new Image(input) as unknown as ManagedNodeUI;
  }

  // 当前剩余节点只可能是 rect。
  return new Rect(input) as unknown as ManagedNodeUI;
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
  if (node.kind === "text" || node.kind === "curvedText") {
    return {
      rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
      x: Math.round(ui.x ?? node.x),
      y: Math.round(ui.y ?? node.y),
    };
  }

  // 普通图形需要同步位置、尺寸和旋转；Math.round 避免拖拽产生长小数污染 store。
  const patch = {
    rotation: Math.round(ui.rotation ?? node.rotation ?? 0),
    x: Math.round(ui.x ?? node.x),
    y: Math.round(ui.y ?? node.y),
  };

  if (node.kind === "line") {
    const lineGroup = ui as IUI & {
      __eraserContent?: Array<{ points?: number[]; strokeWidth?: number }>;
      __lineContent?: { points?: number[]; strokeWidth?: number };
    };
    const lineUI = lineGroup.__lineContent;
    const points = lineUI?.points;
    const eraserPaths = lineGroup.__eraserContent?.map((eraser, index) => ({
      points: eraser.points ? [...eraser.points] : (node.eraserPaths?.[index]?.points ?? []),
      strokeWidth: eraser.strokeWidth ?? node.eraserPaths?.[index]?.strokeWidth ?? 0,
    }));
    const hasChangedPoints =
      points !== undefined &&
      (points.length !== (node.points?.length ?? 0) ||
        points.some((value, index) => value !== node.points?.[index]));
    const hasChangedEraserPaths =
      eraserPaths !== undefined &&
      (eraserPaths.length !== (node.eraserPaths?.length ?? 0) ||
        eraserPaths.some(
          (path, index) =>
            path.strokeWidth !== node.eraserPaths?.[index]?.strokeWidth ||
            path.points.length !== node.eraserPaths?.[index]?.points.length ||
            path.points.some(
              (value, pointIndex) => value !== node.eraserPaths?.[index]?.points[pointIndex],
            ),
        ));

    return {
      ...patch,
      height: Math.round(ui.height ?? node.height),
      width: Math.round(ui.width ?? node.width),
      ...(hasChangedPoints && { points: [...(points ?? [])] }),
      ...(lineUI?.strokeWidth !== undefined && lineUI.strokeWidth !== node.strokeWidth
        ? { strokeWidth: lineUI.strokeWidth }
        : {}),
      ...(hasChangedEraserPaths && { eraserPaths }),
    };
  }

  return {
    ...patch,
    height: Math.round(ui.height ?? node.height),
    width: Math.round(ui.width ?? node.width),
  };
};

/** 增量同步曲线文字的业务字段；Leafer Group 只接收整体几何属性。 */
export const syncCurvedTextUI = (
  ui: ManagedNodeUI,
  node: Extract<CanvasNode, { kind: "curvedText" }>,
) => {
  const curvedText = ui as unknown as CurvedText;
  // 通用 ui.set 会同步业务节点的 editable/draggable；字符编辑是运行时状态，需保留。
  curvedText.set({
    draggable: !curvedText.characterEditing,
    editable: !curvedText.characterEditing,
  });
  curvedText.setText(node.text);
  curvedText.setStyles(node.defaultStyle, node.styleRuns);
  // 最后重排一次，确保半径、字距和弧度使用样式测量完成后的最终参数。
  curvedText.setLayout(node.layout);
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
