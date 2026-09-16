import type { EraserEraseEvent } from "leafer-x-brush-eraser";
import type { IUI } from "leafer-ui";
import type { CanvasLineEraserUpdate, CanvasNode, ManagedNodeUI } from "@/types";
import { findNodeIdByUI } from "../ui/uiMap";

export type EraserMaps = {
  /** 业务节点 id -> 节点类型。 */
  uiKindMap: Map<string, CanvasNode["kind"]>;
  /** 业务节点 id -> 托管 UI。 */
  uiMap: Map<string, ManagedNodeUI>;
};

/**
 * 按 UI 反查可擦除的 line 节点 id。
 *
 * 橡皮擦只擦画笔笔迹，所以非 line 节点一律不参与。
 */
const findLineNodeId = (ui: IUI | undefined, { uiKindMap, uiMap }: EraserMaps) => {
  const id = ui ? findNodeIdByUI(uiMap, ui) : undefined;

  return id && uiKindMap.get(id) === "line" ? id : undefined;
};

/**
 * 判断命中的元素能不能被擦。
 *
 * 命中项通常是 line group 内部的图形子节点（原始笔迹），业务节点是它的父级；
 * 直接命中 group 的情况也一并兼容。
 */
/** 取出命中线节点（line group 本体或内部子节点）对应的业务 id；非 line 节点返回 undefined。 */
export const findErasableLineNodeId = (target: IUI, maps: EraserMaps) =>
  findLineNodeId(target.parent ?? undefined, maps) ?? findLineNodeId(target, maps);

export const isErasableLineTarget = (target: IUI, maps: EraserMaps) =>
  Boolean(findErasableLineNodeId(target, maps));

/**
 * 把一次橡皮擦手势的轨迹转成 store 的 eraser 更新。
 *
 * 插件给出的 points 就在被擦元素父容器的局部空间里，也就是 line group 的局部空间；
 * line 节点本身就按「外接矩形左上角 + 局部点」建模，所以这里的点可以直接当节点局部坐标用。
 */
export const getLineEraserUpdates = (
  strokes: EraserEraseEvent[],
  maps: EraserMaps,
): CanvasLineEraserUpdate[] =>
  strokes
    .map(({ container, points, strokeWidth }) => {
      const id = findLineNodeId(container, maps);

      return id ? { id, points, strokeWidth } : undefined;
    })
    .filter((update): update is CanvasLineEraserUpdate => Boolean(update));
