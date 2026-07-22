import { useEffect } from "react";
import { DragEvent } from "leafer-ui";
import type { CanvasPage } from "@/types";
import { isAdditiveSelect } from "../tools/interaction";
import { syncLineGroupContent } from "../ui/lineUi";
import { createNodeUI, getNodePatchFromUI, getNodeUIInput } from "../ui/nodeUi";
import type { ManagedNodeUI, ParentNodeUI, PointerLikeEvent } from "../shared/types";
import type { useLeaferCanvasRuntime } from "../core/useLeaferCanvasRuntime";

type Runtime = ReturnType<typeof useLeaferCanvasRuntime>;

type UseNodeTreeSyncParams = Pick<
  Runtime,
  | "appRef"
  | "boardRef"
  | "isSyncingEditorSelectionRef"
  | "onSelectNodeRef"
  | "onUpdateNodeRef"
  | "pageRef"
  | "uiKindMapRef"
  | "uiMapRef"
  | "uiParentMapRef"
> &
  Pick<CanvasPage, "nodeMap" | "rootIds">;

/**
 * 将 CanvasPage 的 nodeMap / rootIds 增量同步到 Leafer UI 树。
 *
 * 这个 hook 负责创建缺失 UI、复用已有 UI、按层级排序、移动跨父级节点，
 * 以及删除从业务层级不可达的 stale UI。
 */
export const useNodeTreeSync = ({
  appRef,
  boardRef,
  isSyncingEditorSelectionRef,
  nodeMap,
  onSelectNodeRef,
  onUpdateNodeRef,
  pageRef,
  rootIds,
  uiKindMapRef,
  uiMapRef,
  uiParentMapRef,
}: UseNodeTreeSyncParams) => {
  const uiMap = uiMapRef.current;
  const uiKindMap = uiKindMapRef.current;
  const uiParentMap = uiParentMapRef.current;

  /** 将 nodeMap/rootIds 增量同步到 Leafer UI 树。 */
  useEffect(() => {
    // board 是业务节点的根父容器；还未创建时跳过，等待 stage effect 首次创建。
    const board = boardRef.current as ParentNodeUI | null;

    if (!board) return;
    // reachableIds 记录本轮从 rootIds / childrenIds 能访问到的节点，最后用于删除 stale UI。
    const reachableIds = new Set<string>();
    /**
     * 在删除或替换 UI 前取消 Leafer Editor 当前选区。
     *
     * Editor 内部会持有被选中的 UI 引用；如果先 destroy UI 再取消选区，
     * 后续 editor.select/cancel 可能继续访问已销毁对象，导致选择框异常或元素消失。
     */
    const cancelEditorSelection = () => {
      // 删除或替换 UI 前先取消 Editor 选择，避免 Leafer 继续持有已销毁对象。
      isSyncingEditorSelectionRef.current = true;
      appRef.current?.editor?.cancel();
      isSyncingEditorSelectionRef.current = false;
    };
    /**
     * 删除本 hook 托管的单个 Leafer UI，并同步清理索引。
     *
     * 这个方法只处理指定 nodeId，不清空 app.tree。
     * 它用于 store 删除节点、节点不可达、或同一 id 的 kind 变化需要替换 UI 的场景。
     */
    const removeManagedUI = (id: string) => {
      // 删除节点、kind 变化替换节点时走这里，只销毁指定 nodeId 对应的 UI。
      const ui = uiMap.get(id);

      if (!ui) return;

      cancelEditorSelection();
      // destroy 会让 UI 从当前父容器移除并释放 Leafer 内部资源。
      ui.destroy();
      // 三个索引必须同步清理，否则后续会误认为旧 UI 仍可复用。
      uiMap.delete(id);
      uiKindMap.delete(id);
      uiParentMap.delete(id);
    };
    /**
     * 给新创建的节点 UI 绑定一次交互事件。
     *
     * 事件闭包只捕获稳定的 nodeId；真正需要节点数据时从 pageRef 读取最新 store 快照。
     * 这样 UI 后续 set() 更新时不会重复绑定事件，也不会因为闭包捕获旧 nodeMap 写回旧坐标。
     */
    const bindNodeUIEvents = (nodeId: string, ui: ManagedNodeUI) => {
      // 事件闭包只捕获 nodeId；拖拽结束时从 pageRef 取最新节点，避免用旧坐标生成 patch。
      ui.on("tap", (event: PointerLikeEvent) => {
        // 点击单个 UI 时直接写 store；additive 由 Ctrl/Shift 等修饰键决定。
        onSelectNodeRef.current(nodeId, isAdditiveSelect(event));
      });
      ui.on(DragEvent.END, () => {
        // 拖拽结束后，Leafer UI 上有最新变换；store 需要在这里落盘。
        const latestNode = pageRef.current.nodeMap[nodeId];

        // 节点可能在拖拽过程中被删除，兜底跳过。
        if (!latestNode) return;

        onUpdateNodeRef.current(nodeId, getNodePatchFromUI(ui, latestNode));
      });
    };
    /**
     * 把一个业务节点同步到指定 Leafer 父容器的指定图层位置。
     *
     * 这是节点增量同步的核心递归方法：
     * 1. 新节点只创建自己的 UI。
     * 2. 已有节点只 set 最新属性。
     * 3. kind 变化只替换这个节点自己的 UI。
     * 4. 父级变化或顺序变化只移动 UI 实例，不销毁重建。
     * 5. group 节点继续递归同步 childrenIds。
     */
    const syncNodeToParent = (nodeId: string, parent: ParentNodeUI, index: number) => {
      // nodeMap 是本轮同步的真实数据源。
      const node = nodeMap[nodeId];

      // rootIds / childrenIds 里出现不存在的 id 时跳过，避免脏数据让渲染崩溃。
      if (!node) return;

      // 只要本轮访问到，就认为这个 UI 仍应该存在。
      reachableIds.add(nodeId);

      // 先查是否已有可复用的 Leafer UI。
      let ui = uiMap.get(nodeId);

      if (ui && uiKindMap.get(nodeId) !== node.kind) {
        // Leafer 类由 kind 决定；kind 变化时只能替换这个节点自己的 UI。
        removeManagedUI(nodeId);
        ui = undefined;
      }

      if (!ui) {
        // 新增节点：只创建缺失 UI，不影响其它已存在节点和媒体实例。
        ui = createNodeUI(node) ?? undefined;

        if (!ui) return;

        // 新 UI 只绑定一次事件；后续 set 不会重复绑定。
        bindNodeUIEvents(nodeId, ui);
        // 建立 nodeId 到 UI / kind 的索引，供后续增量同步和事件反查。
        uiMap.set(nodeId, ui);
        uiKindMap.set(nodeId, node.kind);
      } else {
        // 普通属性变化：位置、尺寸、文本、样式都增量写入现有 UI。
        ui.set(getNodeUIInput(node));
      }

      if (node.kind === "line") {
        // line group 自身只负责位置和包围盒；内部原始线和 eraser 轨迹单独同步。
        syncLineGroupContent(ui, node);
      }

      // oldParent 用来判断 group/ungroup 是否让节点跨父容器移动。
      const oldParent = uiParentMap.get(nodeId);

      if (oldParent && oldParent !== parent) {
        // group / ungroup 会改变父容器；移动 UI 时保留实例，不销毁重建。
        oldParent.remove(ui, false);
      }

      if (!parent.children || parent.children[index] !== ui) {
        // 图层顺序由 rootIds / childrenIds 决定，这里只在目标位置不一致时重排。
        if (parent.children) {
          // Leafer remove(..., false) 表示从父容器摘下但不销毁 UI，用于排序和移动。
          parent.remove(ui, false);
        }
        // add(ui, index) 会把 UI 插到目标图层位置。
        parent.add(ui, index);
      }

      // 记录本轮同步后的父容器，供下一轮判断是否跨父级。
      uiParentMap.set(nodeId, parent);

      if (node.kind === "group") {
        // group 的 childrenIds 也按同样规则递归增量同步。
        node.childrenIds.forEach((childId, childIndex) => {
          syncNodeToParent(childId, ui as ParentNodeUI, childIndex);
        });
      }
    };

    // 根图层从 board 开始同步，rootIds 顺序就是根层级图层顺序。
    rootIds.forEach((nodeId, index) => {
      syncNodeToParent(nodeId, board, index);
    });

    // 本轮没有从 rootIds / childrenIds 访问到的 UI，说明已从 store 删除或断开层级。
    [...uiMap.keys()].forEach((nodeId) => {
      if (!reachableIds.has(nodeId)) {
        // store 中已经不可达的节点才销毁；其余节点都复用原 Leafer 实例。
        removeManagedUI(nodeId);
      }
    });
  }, [
    appRef,
    boardRef,
    isSyncingEditorSelectionRef,
    nodeMap,
    onSelectNodeRef,
    onUpdateNodeRef,
    pageRef,
    rootIds,
    uiKindMap,
    uiMap,
    uiParentMap,
  ]);
};
