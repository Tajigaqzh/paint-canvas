import { DragEvent } from "leafer-ui";
import type { RefObject } from "react";
import type {
  CanvasNode,
  CanvasPage,
  EditableLeaferApp,
  ManagedNodeUI,
  ParentNodeUI,
  PointerLikeEvent,
} from "@/types";
import { isAdditiveSelect } from "../tools/additiveSelect";
import { getAnimationSignature, getLeaferAnimation } from "../ui/animation";
import { disposeImageSource, syncImageSource } from "../ui/imageUi";
import { syncLineGroupContent } from "../ui/lineUi";
import { createNodeUI, getNodePatchFromUI, getNodeUIInput } from "../ui/nodeUi";

/** 节点树增量同步所需的托管索引和 store 回调。 */
export type NodeTreeSyncContext = {
  app: EditableLeaferApp | null;
  board: ParentNodeUI;
  isSyncingEditorSelectionRef: { current: boolean };
  nodeMap: CanvasPage["nodeMap"];
  onSelectNodeRef: RefObject<(id?: string, additive?: boolean) => void>;
  onUpdateNodeRef: RefObject<(id: string, data: Partial<CanvasNode>) => void>;
  pageRef: RefObject<CanvasPage>;
  uiKindMap: Map<string, CanvasNode["kind"]>;
  uiMap: Map<string, ManagedNodeUI>;
  uiParentMap: Map<string, ParentNodeUI>;
  animationSignatureMap: Map<string, string>;
};

/**
 * 删除或替换 UI 前先取消 Editor 选区。
 * Editor 会持有被选 UI 引用；先 destroy 再 cancel 可能访问已销毁对象。
 */
const cancelEditorSelection = (ctx: NodeTreeSyncContext) => {
  ctx.isSyncingEditorSelectionRef.current = true;
  ctx.app?.editor?.cancel();
  ctx.isSyncingEditorSelectionRef.current = false;
};

/**
 * 只销毁指定 nodeId 对应的托管 UI，不清空 app.tree。
 * 用于 store 删除、节点不可达、或同一 id 的 kind 变化需要替换 UI。
 */
const removeManagedUI = (ctx: NodeTreeSyncContext, id: string) => {
  const ui = ctx.uiMap.get(id);

  if (!ui) return;

  cancelEditorSelection(ctx);
  disposeImageSource(id, ui);
  ui.destroy();
  ctx.uiMap.delete(id);
  ctx.uiKindMap.delete(id);
  ctx.uiParentMap.delete(id);
  ctx.animationSignatureMap.delete(id);
};

/**
 * 新 UI 只绑定一次事件；闭包只捕获 nodeId，数据从当前 page 快照读取。
 */
const bindNodeUIEvents = (ctx: NodeTreeSyncContext, nodeId: string, ui: ManagedNodeUI) => {
  ui.on("tap", (event: PointerLikeEvent) => {
    ctx.onSelectNodeRef.current(nodeId, isAdditiveSelect(event));
  });
  ui.on(DragEvent.END, () => {
    const latestNode = ctx.pageRef.current.nodeMap[nodeId];

    if (!latestNode) return;

    ctx.onUpdateNodeRef.current(nodeId, getNodePatchFromUI(ui, latestNode));
  });
};

/**
 * 把单个业务节点同步到指定父容器的指定图层位置，并按需递归 group 子节点。
 *
 * 1. 新节点只创建自己的 UI。
 * 2. 已有节点只 set 最新属性。
 * 3. kind 变化只替换这个节点自己的 UI。
 * 4. 父级或顺序变化只移动 UI 实例。
 * 5. animation 只有签名变化才重写，避免拖拽打断播放。
 */
const syncNodeToParent = (
  ctx: NodeTreeSyncContext,
  reachableIds: Set<string>,
  nodeId: string,
  parent: ParentNodeUI,
  index: number,
) => {
  const node = ctx.nodeMap[nodeId];

  if (!node) return;

  reachableIds.add(nodeId);

  let ui = ctx.uiMap.get(nodeId);

  if (ui && ctx.uiKindMap.get(nodeId) !== node.kind) {
    removeManagedUI(ctx, nodeId);
    ui = undefined;
  }

  if (!ui) {
    ui = createNodeUI(node) ?? undefined;

    if (!ui) return;

    bindNodeUIEvents(ctx, nodeId, ui);
    ctx.uiMap.set(nodeId, ui);
    ctx.uiKindMap.set(nodeId, node.kind);
    ctx.animationSignatureMap.set(nodeId, getAnimationSignature(node.animationList));
  } else {
    ui.set(getNodeUIInput(node));

    const animationSignature = getAnimationSignature(node.animationList);

    if (ctx.animationSignatureMap.get(nodeId) !== animationSignature) {
      ctx.animationSignatureMap.set(nodeId, animationSignature);
      ui.set({ animation: getLeaferAnimation(node.animationList) });
    }
  }

  if (node.kind === "line") {
    syncLineGroupContent(ui, node);
  }

  if (node.kind === "image") {
    syncImageSource(nodeId, ui, node);
  }

  const oldParent = ctx.uiParentMap.get(nodeId);

  if (oldParent && oldParent !== parent) {
    oldParent.remove(ui, false);
  }

  if (!parent.children || parent.children[index] !== ui) {
    if (parent.children) {
      parent.remove(ui, false);
    }
    parent.add(ui, index);
  }

  ctx.uiParentMap.set(nodeId, parent);

  if (node.kind === "group") {
    node.childrenIds.forEach((childId, childIndex) => {
      syncNodeToParent(ctx, reachableIds, childId, ui as ParentNodeUI, childIndex);
    });
  }
};

/**
 * 将 CanvasPage 的 rootIds / nodeMap 增量同步到 board 下的 Leafer UI 树。
 * 本轮不可达的托管 UI 会被销毁；其余实例全部复用。
 */
export const syncCanvasPageToLeafer = (ctx: NodeTreeSyncContext, rootIds: string[]) => {
  const reachableIds = new Set<string>();

  rootIds.forEach((nodeId, index) => {
    syncNodeToParent(ctx, reachableIds, nodeId, ctx.board, index);
  });

  [...ctx.uiMap.keys()].forEach((nodeId) => {
    if (!reachableIds.has(nodeId)) {
      removeManagedUI(ctx, nodeId);
    }
  });
};
