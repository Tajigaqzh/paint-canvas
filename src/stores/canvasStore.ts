import { applyPatches, enablePatches, produceWithPatches } from "immer";
import { nanoid } from "nanoid";
import { create } from "zustand";
import type {
  CanvasDocument,
  CanvasHistoryEntry,
  CanvasNode,
  CanvasNodeKind,
  CanvasStore,
  GroupNode,
} from "@/pages/home/types";

// immer 的 patch 能记录“本次操作修改了哪些字段”以及“如何反向恢复”。
// 这里启用 patches 后，produceWithPatches 才会返回 patches / inversePatches。
enablePatches();

// 撤销历史上限。历史记录保存的是 patch，而不是完整画布快照；
// 即便如此，拖拽、缩放、文字编辑这类操作多起来以后仍然需要限制长度。
const HISTORY_LIMIT = 80;

// serial 只用于生成默认名称，例如“矩形 1”“组 3”。
// 节点真正的唯一标识使用 createId 生成的 id。
let serial = 0;

// past / future 是撤销、重做栈。
// 它们没有放进 zustand state，原因是历史栈变化不需要触发 React 组件重渲染；
// UI 只关心 canUndo / canRedo 这两个派生布尔值。
let past: CanvasHistoryEntry[] = [];
let future: CanvasHistoryEntry[] = [];

// 节点 ID 统一由 nanoid 生成，避免依赖浏览器 crypto.randomUUID 的兼容性。
const createId = () => `node-${nanoid()}`;

// 获取某个父级下的图层数组引用。
// - parentId 为空：操作根层级 rootIds
// - parentId 指向 group：操作这个 group 的 childrenIds
// 返回的是数组引用，所以调用方可以直接 splice 修改顺序。
const getLayerIds = (document: CanvasDocument, parentId?: string) => {
  if (!parentId) return document.rootIds;

  const parent = document.nodeMap[parentId];

  return parent?.kind === "group" ? parent.childrenIds : document.rootIds;
};

// 打组只允许“同父级”的多选节点。
// 例如 A、B 都在根层级，可以打组；A 在根层级、B 在某个 group 里，则不能直接打组。
// 这样能避免跨层级打组时图层顺序和 parentId 归属变得不明确。
const getSelectedSiblingIds = (document: CanvasDocument) => {
  const first = document.nodeMap[document.selectedIds[0]];

  if (!first) return [];

  return document.selectedIds.filter((id) => document.nodeMap[id]?.parentId === first.parentId);
};

const isSameIdList = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

const getNodeBounds = (node: CanvasNode) => ({
  height: "height" in node ? node.height : node.fontSize,
  width: "width" in node ? node.width : Math.max(node.text.length * node.fontSize, 1),
  x: node.x,
  y: node.y,
});

const getGroupBounds = (nodes: CanvasNode[]) => {
  const bounds = nodes.map(getNodeBounds);
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));

  return {
    height: Math.max(maxY - minY, 1),
    width: Math.max(maxX - minX, 1),
    x: minX,
    y: minY,
  };
};

const createNode = (kind: Exclude<CanvasNodeKind, "group">, index: number): CanvasNode => {
  serial += 1;

  // 新节点按现有根节点数量做轻微错位，避免连续添加时完全重叠。
  const baseX = 180 + index * 24;
  const baseY = 140 + index * 20;
  const id = createId();

  if (kind === "ellipse") {
    return {
      animationList: [],
      id,
      kind,
      name: `圆形 ${serial}`,
      rotation: 0,
      transformOrigin: "center",
      x: baseX,
      y: baseY,
      width: 132,
      height: 132,
      fill: "#14b8a6",
    };
  }

  if (kind === "text") {
    return {
      animationList: [],
      id,
      kind,
      name: `文本 ${serial}`,
      rotation: 0,
      transformOrigin: "center",
      x: baseX,
      y: baseY,
      fill: "#111827",
      fontSize: 28,
      fontWeight: 600,
      text: "双击编辑文本",
    };
  }

  return {
    animationList: [],
    id,
    kind,
    name: `矩形 ${serial}`,
    rotation: 0,
    transformOrigin: "center",
    x: baseX,
    y: baseY,
    width: 180,
    height: 112,
    cornerRadius: 12,
    fill: "#4f46e5",
  };
};

// 初始文档放两个元素，方便打开页面后可以直接测试选择、拖拽、打组、撤销。
const initialNodes = [createNode("rect", 0), createNode("text", 1)];

// 文档结构使用“扁平字典 + 层级 id 列表”：
// - nodeMap 保存所有节点实体
// - rootIds 保存根层级图层顺序
// - group.childrenIds 保存组内图层顺序
// 这种结构比 children 嵌套对象更适合按 id 查找、更新、撤销和同步 Leafer 实例。
const initialDocument: CanvasDocument = {
  activeId: undefined,
  nodeMap: Object.fromEntries(initialNodes.map((node) => [node.id, node])),
  rootIds: initialNodes.map((node) => node.id),
  selectedIds: [],
  viewport: {
    height: 1080,
    width: 1920,
  },
};

// 根据当前文档和历史栈推导 UI 可用状态。
// 这些字段进入 zustand state，让按钮禁用态可以响应更新；
// past / future 本身仍然留在模块变量里。
const deriveFlags = (document: CanvasDocument) => {
  const siblingIds = getSelectedSiblingIds(document);

  return {
    canGroup: siblingIds.length > 1,
    canRedo: future.length > 0,
    canUngroup: document.selectedIds.some((id) => document.nodeMap[id]?.kind === "group"),
    canUndo: past.length > 0,
  };
};

// 把树形层级拍平成 Leafer 的渲染列表。
// group 节点自身不直接渲染成 Leafer Group；当前实现把组作为数据层级，
// 渲染时递归输出它的子节点，从而保留组内 childrenIds 的图层顺序。
export const flattenCanvasNodes = (document: CanvasDocument) => {
  const list: CanvasNode[] = [];

  const visit = (ids: string[]) => {
    ids.forEach((id) => {
      const node = document.nodeMap[id];

      if (!node) return;

      if (node.kind === "group") {
        visit(node.childrenIds);
        return;
      }

      list.push(node);
    });
  };

  visit(document.rootIds);

  return list;
};

export const useCanvasStore = create<CanvasStore>((set, get) => {
  // 把文档状态和派生按钮状态合并后写入 zustand。
  const sync = (document: CanvasDocument) => ({
    ...document,
    ...deriveFlags(document),
  });

  // 从 zustand 当前状态中抽取“真正需要进入历史记录”的文档部分。
  // canUndo / canRedo / canGroup / canUngroup 都是派生值，不进入 patches。
  const snapshot = (): CanvasDocument => ({
    activeId: get().activeId,
    nodeMap: get().nodeMap,
    rootIds: get().rootIds,
    selectedIds: get().selectedIds,
    viewport: get().viewport,
  });

  // 所有需要进入撤销/重做历史的写操作都走 commit。
  // recipe 只描述如何修改 draft；immer 会生成：
  // - next：修改后的完整文档
  // - patches：从旧文档到 next 的正向补丁，用于 redo
  // - inversePatches：从 next 回到旧文档的反向补丁，用于 undo
  const commit = (recipe: (draft: CanvasDocument) => void) => {
    const [next, patches, inversePatches] = produceWithPatches(snapshot(), recipe);

    if (patches.length === 0) return;

    // 新操作产生后，旧的 redo 分支必须清空。
    // 例：撤销两步后又添加了新矩形，此时原来的“下一步”已经不再成立。
    past = [...past, { patches, inversePatches }].slice(-HISTORY_LIMIT);
    future = [];
    set(sync(next));
  };

  return {
    ...initialDocument,
    ...deriveFlags(initialDocument),
    addNode(kind) {
      commit((draft) => {
        const node = createNode(kind, draft.rootIds.length);

        // 新增节点默认放到根层级最上方，并立即作为当前选中节点。
        draft.nodeMap[node.id] = node;
        draft.rootIds.push(node.id);
        draft.selectedIds = [node.id];
        draft.activeId = node.id;
      });
    },
    bringForward(id = get().activeId) {
      if (!id) return;

      commit((draft) => {
        const node = draft.nodeMap[id];
        const layerIds = getLayerIds(draft, node?.parentId);
        const index = layerIds.indexOf(id);

        // 已经在当前同级列表最顶层时，不产生历史记录。
        if (index === -1 || index === layerIds.length - 1) return;

        // 图层顺序由 id 数组决定：越靠后越在上层。
        layerIds.splice(index, 1);
        layerIds.splice(index + 1, 0, id);
      });
    },
    groupSelected() {
      commit((draft) => {
        const siblingIds = getSelectedSiblingIds(draft);

        // 只有两个及以上同父级节点才可以组成一个 group。
        if (siblingIds.length < 2) return;

        serial += 1;

        const first = draft.nodeMap[siblingIds[0]];
        const selectedNodes = siblingIds
          .map((id) => draft.nodeMap[id])
          .filter((node): node is CanvasNode => Boolean(node));
        const groupId = createId();
        const layerIds = getLayerIds(draft, first.parentId);
        const selectedSet = new Set(siblingIds);
        const bounds = getGroupBounds(selectedNodes);
        // 新 group 会插入到被选中节点中最靠下的那个位置，尽量保持原图层位置稳定。
        const firstIndex = layerIds.findIndex((id) => selectedSet.has(id));
        const groupNode: GroupNode = {
          animationList: [],
          childrenIds: siblingIds,
          fill: "transparent",
          height: bounds.height,
          id: groupId,
          kind: "group",
          name: `组 ${serial}`,
          parentId: first.parentId,
          rotation: 0,
          transformOrigin: "center",
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        };

        // 子节点仍然保存在 nodeMap 里，只是 parentId 改成新 group。
        // group.childrenIds 保存这些子节点在组内的图层顺序。
        siblingIds.forEach((id) => {
          const child = draft.nodeMap[id];

          child.parentId = groupId;
          child.x -= bounds.x;
          child.y -= bounds.y;
        });

        draft.nodeMap[groupId] = groupNode;
        // 先从当前同级图层列表里移除被打组的节点。
        layerIds.splice(0, layerIds.length, ...layerIds.filter((id) => !selectedSet.has(id)));
        // 再把 group 节点放回原来的位置。
        layerIds.splice(firstIndex, 0, groupId);
        draft.selectedIds = [groupId];
        draft.activeId = groupId;
      });
    },
    redo() {
      const entry = future.at(-1);

      if (!entry) return;

      // redo 会消费 future 顶部记录，并把它重新放回 past。
      future = future.slice(0, -1);
      past = [...past, entry].slice(-HISTORY_LIMIT);
      set(sync(applyPatches(snapshot(), entry.patches)));
    },
    reset() {
      // reset 是明确的清空动作，不进入历史；它会同时清掉 undo / redo 栈。
      past = [];
      future = [];
      set(sync(initialDocument));
    },
    selectNode(id, additive = false) {
      if (!id) {
        // 传空 id 表示清空选择。
        set(sync({ ...snapshot(), activeId: undefined, selectedIds: [] }));
        return;
      }

      if (!additive) {
        // 普通点击：单选当前节点。
        set(sync({ ...snapshot(), activeId: id, selectedIds: [id] }));
        return;
      }

      // Ctrl / Shift 点击：切换当前节点是否在多选集合中。
      const selectedSet = new Set(get().selectedIds);

      if (selectedSet.has(id)) {
        selectedSet.delete(id);
      } else {
        selectedSet.add(id);
      }

      const selectedIds = [...selectedSet];

      set(sync({ ...snapshot(), activeId: id, selectedIds }));
    },
    selectNodes(ids) {
      const validIds = ids.filter((id) => Boolean(get().nodeMap[id]));

      if (isSameIdList(get().selectedIds, validIds)) return;

      set(
        sync({
          ...snapshot(),
          activeId: validIds.at(-1),
          selectedIds: validIds,
        }),
      );
    },
    sendBackward(id = get().activeId) {
      if (!id) return;

      commit((draft) => {
        const node = draft.nodeMap[id];
        const layerIds = getLayerIds(draft, node?.parentId);
        const index = layerIds.indexOf(id);

        // 已经在当前同级列表最底层时，不产生历史记录。
        if (index <= 0) return;

        // 图层顺序由 id 数组决定：越靠前越在下层。
        layerIds.splice(index, 1);
        layerIds.splice(index - 1, 0, id);
      });
    },
    undo() {
      const entry = past.at(-1);

      if (!entry) return;

      // undo 会消费 past 顶部记录，并把它放入 future，供 redo 恢复。
      past = past.slice(0, -1);
      future = [...future, entry].slice(HISTORY_LIMIT * -1);
      set(sync(applyPatches(snapshot(), entry.inversePatches)));
    },
    ungroupSelected() {
      commit((draft) => {
        // 支持一次拆开多个已选 group。
        const groupIds = draft.selectedIds.filter((id) => draft.nodeMap[id]?.kind === "group");

        if (groupIds.length === 0) return;

        const nextSelectedIds: string[] = [];

        groupIds.forEach((groupId) => {
          const group = draft.nodeMap[groupId];

          if (!group || group.kind !== "group") return;

          const layerIds = getLayerIds(draft, group.parentId);
          const index = layerIds.indexOf(groupId);

          if (index === -1) return;

          // 子节点 parentId 恢复为 group 原来的父级；
          // 如果 group 在根层级，子节点 parentId 也会变回 undefined。
          group.childrenIds.forEach((childId) => {
            const child = draft.nodeMap[childId];

            child.parentId = group.parentId;
            child.x += group.x;
            child.y += group.y;
          });
          // 在原位置用子节点列表替换 group 节点，保持拆组前后视觉层级尽量稳定。
          layerIds.splice(index, 1, ...group.childrenIds);
          nextSelectedIds.push(...group.childrenIds);
          delete draft.nodeMap[groupId];
        });

        draft.selectedIds = nextSelectedIds;
        draft.activeId = nextSelectedIds.at(-1);
      });
    },
    updateNode(id, data) {
      commit((draft) => {
        const node = draft.nodeMap[id];

        // 元素和 group 都允许更新基础变换属性。
        // group 的 childrenIds / kind / id 这类结构字段不能从属性面板随意覆盖，
        // 否则会破坏 nodeMap + 图层列表之间的引用关系。
        if (!node) return;

        Object.assign(node, data);
      });
    },
  };
});
