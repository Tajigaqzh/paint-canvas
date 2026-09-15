import { Line } from "leafer-ui";
import type { LineGroupUI, LineNode, ManagedNodeUI, NodeUIInput } from "@/types";
import { getNodePaintInput } from "./paint";

/**
 * 线条节点的场景标识前缀。
 *
 * 画笔手绘的笔迹用 brush，素材面板插入的线条用 line；老文档没有 source 字段时按 line 处理。
 * 第三方遍历 Leafer 场景时靠它区分「笔迹节点」和内部渲染元素。
 */
export const getLineClassPrefix = (node: LineNode) => (node.source === "brush" ? "brush" : "line");

/**
 * 线条内部子元素的 className。
 *
 * 例如画笔笔迹：组是 `brush`，本体是 `brush-path`，擦除轨迹是 `brush-eraser`，
 * eraser 占位是 `brush-eraser-primer`。
 */
export const getLineClass = (node: LineNode, part: "eraser" | "eraser-primer" | "path") =>
  `${getLineClassPrefix(node)}-${part}`;

/**
 * 生成原始 line 子节点的渲染输入。
 *
 * line group 自己持有 node.x / node.y 和包围盒；内部真实 Line 只表达局部路径，
 * 所以这里固定 x=0、y=0、rotation=0，并把 node.points 作为局部坐标传给 Leafer。
 */
export const getLineContentInput = (node: LineNode): NodeUIInput => ({
  ...getNodePaintInput(node),
  className: getLineClass(node, "path"),
  cornerRadius: node.cornerRadius,
  curve: node.curve,
  draggable: false,
  editable: false,
  fill: node.fill,
  height: node.height,
  origin: "top-left",
  points: node.points ? [...node.points] : undefined,
  rotation: 0,
  width: node.width,
  x: 0,
  y: 0,
});

/**
 * 生成单条 eraser 轨迹的 Leafer Line 输入。
 *
 * `eraser: "pixel"` 会让这条 Line 按描边像素擦除同 group 内更底层的内容。
 * points 只有一个点时补成极短线段，避免路径不成段导致 Leafer 不渲染擦除效果。
 */
export const getLineEraserInput = (
  points: number[],
  strokeWidth: number,
  className?: string,
): NodeUIInput => ({
  className,
  draggable: false,
  editable: false,
  eraser: "pixel",
  fill: "transparent",
  height: 1,
  origin: "top-left",
  points: points.length === 2 ? [points[0], points[1], points[0] + 0.1, points[1] + 0.1] : points,
  stroke: "#000000",
  strokeCap: "round",
  strokeWidth,
  width: 1,
  x: 0,
  y: 0,
});

/**
 * 创建一个 Leafer eraser Line。
 *
 * 实时拖动预览和根据 store.eraserPaths 重建持久擦除层都走这个方法，
 * 这样主画布里“正在擦”和“已经擦过”的视觉规则保持一致。
 */
export const createLineEraserUI = (points: number[], strokeWidth: number, className?: string) =>
  new Line(getLineEraserInput(points, strokeWidth, className));

/**
 * 创建不可见 eraser 占位节点。
 *
 * 首次给 group 添加 eraser 子节点时，Leafer 可能需要初始化 eraser 合成流程。
 * 预先放一个不可见占位，可以避免用户第一次擦线时看到一帧灰底或普通描边。
 */
export const createLineEraserPrimerUI = (className?: string) =>
  new Line({
    ...getLineEraserInput([0, 0, 0.1, 0.1], 0, className),
    visible: 0,
  });

/**
 * 同步 line group 内部结构：原始笔迹在下，所有 eraser 轨迹在上。
 *
 * 这里是“单个 line group 内部重建”，不是重建整个画布：
 * 1. 原始 __lineContent 会复用，只 set 最新 points / 样式。
 * 2. eraserPaths 对应的 eraser 子节点会按 store 重新生成。
 * 3. 重建范围只限当前 line 的 eraser 子节点，不影响其它节点或媒体实例。
 */
export const syncLineGroupContent = (ui: ManagedNodeUI, node: LineNode) => {
  const group = ui as LineGroupUI;

  if (!group.__lineContent) {
    group.__lineContent = new Line(getLineContentInput(node));
    group.add?.(group.__lineContent, 0);
  } else {
    group.__lineContent.set(getLineContentInput(node));
  }

  if (!group.__eraserPrimer) {
    group.__eraserPrimer = createLineEraserPrimerUI(getLineClass(node, "eraser-primer"));
    group.add?.(group.__eraserPrimer);
  }

  // eraserPaths 变化时直接重建这一组 eraser 子节点，数量通常很少，逻辑更稳定。
  group.__eraserContent?.forEach((eraser) => {
    eraser.destroy();
  });
  group.__eraserContent = (node.eraserPaths ?? []).map((eraserPath) => {
    const eraser = createLineEraserUI(
      eraserPath.points,
      eraserPath.strokeWidth,
      getLineClass(node, "eraser"),
    );

    group.add?.(eraser);

    return eraser;
  });
};
