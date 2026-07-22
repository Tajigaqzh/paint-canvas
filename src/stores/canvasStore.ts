import { apply, create as createMutative } from "mutative";
import { nanoid } from "nanoid";
import { create } from "zustand";
import type {
  CanvasDocument,
  CanvasHistoryEntry,
  CanvasLineEraserUpdate,
  CanvasMaterialKind,
  CanvasNode,
  CanvasNodeUpdate,
  CanvasPage,
  CanvasStore,
  CanvasViewport,
  GroupNode,
  LineNode,
} from "@/types";

/**
 * mutative 的 patch 能记录“本次操作修改了哪些字段”以及“如何反向恢复”。
 * commit 里启用 patches 后，create 才会返回 patches / inversePatches。
 */
/**
 * 撤销历史上限。
 * 历史记录保存的是 patch，而不是完整画布快照；即便如此，
 * 拖拽、缩放、文字编辑这类操作多起来以后仍然需要限制长度。
 */
const HISTORY_LIMIT = 80;

/** 画布默认设计尺寸，所有页面默认沿用同一套坐标系。 */
const DEFAULT_VIEWPORT: CanvasViewport = {
  height: 1080,
  width: 1920,
};

/**
 * 节点默认名称序号，例如“矩形 1”“组 3”。
 * 节点真正的唯一标识使用 createId 生成的 id。
 */
let serial = 0;

/** 页面默认名称序号，例如“页面 1”。 */
let pageSerial = 0;

/**
 * past / future 是撤销、重做栈。
 * 它们没有放进 zustand state，原因是历史栈变化不需要触发 React 组件重渲染；
 * UI 只关心 canUndo / canRedo 这两个派生布尔值。
 */
let past: CanvasHistoryEntry[] = [];
let future: CanvasHistoryEntry[] = [];

/** 节点 ID 统一由 nanoid 生成，避免依赖浏览器 crypto.randomUUID 的兼容性。 */
const createId = () => `node-${nanoid()}`;

/** 页面 ID 统一带 page 前缀，方便调试时和节点 ID 区分。 */
const createPageId = () => `page-${nanoid()}`;

/** 获取当前激活页面；兜底返回第一页，避免旧数据 activePageId 缺失时 UI 崩溃。 */
const getActivePage = (document: CanvasDocument) =>
  document.pages[document.activePageId] ?? document.pages[document.pageIds[0]];

/** 用局部字段更新当前页面，并保持文档的页面字典不可变更新。 */
const updateActivePage = (document: CanvasDocument, data: Partial<CanvasPage>): CanvasDocument => {
  const page = getActivePage(document);

  return {
    ...document,
    pages: {
      ...document.pages,
      [page.id]: {
        ...page,
        ...data,
      },
    },
  };
};

/**
 * 获取某个父级下的图层数组引用。
 * parentId 为空时操作根层级 rootIds，parentId 指向 group 时操作 group.childrenIds。
 * 返回的是数组引用，所以调用方可以直接 splice 修改顺序。
 */
const getLayerIds = (page: CanvasPage, parentId?: string) => {
  if (!parentId) return page.rootIds;

  const parent = page.nodeMap[parentId];

  return parent?.kind === "group" ? parent.childrenIds : page.rootIds;
};

/**
 * 过滤出当前选区里和第一个节点同父级的节点。
 * 打组只允许同父级多选，避免跨层级打组时图层顺序和 parentId 归属变得不明确。
 */
const getSelectedSiblingIds = (page: CanvasPage) => {
  const first = page.nodeMap[page.selectedIds[0]];

  if (!first) return [];

  return page.selectedIds.filter((id) => page.nodeMap[id]?.parentId === first.parentId);
};

/** 判断两个 ID 列表是否完全一致，用来跳过重复选区更新。 */
const isSameIdList = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

/** 获取节点的基础包围盒；文本节点没有 width / height 时按字号和文本长度估算。 */
const getNodeBounds = (node: CanvasNode) => ({
  height: "height" in node ? node.height : node.fontSize,
  width: "width" in node ? node.width : Math.max(node.text.length * node.fontSize, 1),
  x: node.x,
  y: node.y,
});

/** 根据多个节点的包围盒计算 group 的外接矩形。 */
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

/** 从页面中删除节点；如果目标是 group，会递归删除它的所有子节点。 */
const removeNodeFromPage = (page: CanvasPage, id: string) => {
  const node = page.nodeMap[id];

  if (!node) return false;

  const layerIds = getLayerIds(page, node.parentId);
  const index = layerIds.indexOf(id);

  if (index > -1) {
    layerIds.splice(index, 1);
  }

  if (node.kind === "group") {
    [...node.childrenIds].forEach((childId) => {
      removeNodeFromPage(page, childId);
    });
  }

  delete page.nodeMap[id];
  page.selectedIds = page.selectedIds.filter((selectedId) => selectedId !== id);
  page.activeId = page.selectedIds.at(-1);

  return true;
};

/** 根据素材类型创建默认节点数据。 */
const createNode = (kind: CanvasMaterialKind, index: number): CanvasNode => {
  serial += 1;

  /** 新节点按现有根节点数量做轻微错位，避免连续添加时完全重叠。 */
  const baseX = 180 + index * 24;
  const baseY = 140 + index * 20;
  const id = createId();

  if (
    kind === "circle" ||
    kind === "ellipse" ||
    kind === "ring" ||
    kind === "sector" ||
    kind === "sector-ring" ||
    kind === "arc"
  ) {
    const ellipseNames: Record<typeof kind, string> = {
      arc: "圆角弧线",
      circle: "圆形",
      ellipse: "椭圆",
      ring: "圆环",
      sector: "扇形",
      "sector-ring": "扇形圆环",
    };

    return {
      animationList: [],
      closed: kind !== "arc",
      cornerRadius: kind === "sector-ring" ? 10 : undefined,
      ellipseMode: kind,
      endAngle: kind === "sector" || kind === "sector-ring" || kind === "arc" ? 180 : undefined,
      fill: kind === "arc" ? "transparent" : "#32cd79",
      height: kind === "ellipse" ? 160 : 132,
      id,
      innerRadius: kind === "ring" || kind === "sector-ring" ? 0.5 : undefined,
      kind: "ellipse",
      name: `${ellipseNames[kind]} ${serial}`,
      rotation: 0,
      startAngle: kind === "sector" || kind === "sector-ring" || kind === "arc" ? -60 : undefined,
      stroke: kind === "arc" ? "#32cd79" : "#0f172a",
      strokeAlign: kind === "arc" ? "center" : undefined,
      strokeCap: kind === "arc" ? "round" : undefined,
      strokeStyle: "solid",
      strokeWidth: kind === "arc" ? 10 : 0,
      transformOrigin: "center",
      width: 132,
      x: baseX,
      y: baseY,
    };
  }

  if (kind === "line") {
    return {
      animationList: [],
      curve: false,
      fill: "transparent",
      height: 0,
      id,
      kind,
      name: `线条 ${serial}`,
      rotation: 0,
      stroke: "#32cd79",
      strokeCap: "round",
      strokeStyle: "solid",
      strokeWidth: 8,
      transformOrigin: "center",
      width: 180,
      x: baseX,
      y: baseY,
    };
  }

  if (kind === "triangle" || kind === "polygon") {
    return {
      animationList: [],
      cornerRadius: 0,
      fill: "#32cd79",
      height: 132,
      id,
      kind: "polygon",
      name: `${kind === "triangle" ? "三角形" : "正多边形"} ${serial}`,
      polygonMode: kind,
      rotation: 0,
      sides: kind === "triangle" ? 3 : 6,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      transformOrigin: "center",
      width: 132,
      x: baseX,
      y: baseY,
    };
  }

  if (kind === "star") {
    return {
      animationList: [],
      cornerRadius: 0,
      corners: 5,
      fill: "#32cd79",
      height: 132,
      id,
      innerRadius: 0.45,
      kind,
      name: `星形 ${serial}`,
      rotation: 0,
      startAngle: -90,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      transformOrigin: "center",
      width: 132,
      x: baseX,
      y: baseY,
    };
  }

  if (kind === "text") {
    return {
      animationList: [],
      fill: "#111827",
      fontSize: 28,
      fontWeight: 600,
      id,
      kind,
      name: `文本 ${serial}`,
      rotation: 0,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      text: "双击编辑文本",
      transformOrigin: "center",
      x: baseX,
      y: baseY,
    };
  }

  return {
    animationList: [],
    cornerRadius: 12,
    fill: "#4f46e5",
    height: 112,
    id,
    kind,
    name: `矩形 ${serial}`,
    rotation: 0,
    stroke: "#0f172a",
    strokeStyle: "solid",
    strokeWidth: 0,
    transformOrigin: "center",
    width: 180,
    x: baseX,
    y: baseY,
  };
};

/** 创建一页画布，并把传入节点作为根层级节点写入页面。 */
const createPage = (name?: string, nodes: CanvasNode[] = []): CanvasPage => {
  pageSerial += 1;

  return {
    activeId: undefined,
    id: createPageId(),
    name: name ?? `页面 ${pageSerial}`,
    nodeMap: Object.fromEntries(nodes.map((node) => [node.id, node])),
    rootIds: nodes.map((node) => node.id),
    selectedIds: [],
    viewport: DEFAULT_VIEWPORT,
  };
};

/** 初始页面放两个元素，方便打开页面后可以直接测试选择、拖拽、打组、撤销。 */
const initialPage = createPage("页面 1", [createNode("rect", 0), createNode("text", 1)]);

/**
 * 文档结构使用“多页 + 每页扁平字典 + 层级 id 列表”：
 * document.pageIds 保存页面顺序，document.pages 保存所有页面，
 * page.nodeMap / page.rootIds / group.childrenIds 保存单页内节点层级。
 */
const initialDocument: CanvasDocument = {
  activePageId: initialPage.id,
  pageIds: [initialPage.id],
  pages: {
    [initialPage.id]: initialPage,
  },
};

/**
 * 根据当前文档和历史栈推导 UI 可用状态。
 * 这些字段进入 zustand state，让按钮禁用态可以响应更新；
 * past / future 本身仍然留在模块变量里。
 */
const deriveFlags = (document: CanvasDocument) => {
  const page = getActivePage(document);
  const siblingIds = getSelectedSiblingIds(page);

  return {
    canGroup: siblingIds.length > 1,
    canRedo: future.length > 0,
    canUngroup: page.selectedIds.some((id) => page.nodeMap[id]?.kind === "group"),
    canUndo: past.length > 0,
  };
};

/**
 * 把单页树形层级拍平成 Leafer 的渲染列表。
 * group 节点自身不直接渲染成 Leafer Group；当前实现把组作为数据层级，
 * 渲染时递归输出它的子节点，从而保留组内 childrenIds 的图层顺序。
 */
export const flattenCanvasNodes = (page: CanvasPage) => {
  const list: CanvasNode[] = [];

  const visit = (ids: string[]) => {
    ids.forEach((id) => {
      const node = page.nodeMap[id];

      if (!node) return;

      if (node.kind === "group") {
        visit(node.childrenIds);
        return;
      }

      list.push(node);
    });
  };

  visit(page.rootIds);

  return list;
};

/** 画布核心状态仓库，集中管理页面、节点、选区、图层顺序和撤销重做。 */
export const useCanvasStore = create<CanvasStore>((set, get) => {
  /** 把文档状态、当前页面和派生按钮状态合并后写入 zustand。 */
  const sync = (document: CanvasDocument) => ({
    ...document,
    activePage: getActivePage(document),
    ...deriveFlags(document),
  });

  /**
   * 从 zustand 当前状态中抽取“真正需要进入历史记录”的文档部分。
   * canUndo / canRedo / canGroup / canUngroup / activePage 都是派生值，不进入 patches。
   */
  const snapshot = (): CanvasDocument => ({
    activePageId: get().activePageId,
    pageIds: get().pageIds,
    pages: get().pages,
  });

  /**
   * 所有需要进入撤销/重做历史的写操作都走 commit。
   * recipe 只描述如何修改 draft；mutative 会生成：
   * - next：修改后的完整文档
   * - patches：从旧文档到 next 的正向补丁，用于 redo
   * - inversePatches：从 next 回到旧文档的反向补丁，用于 undo
   */
  const commit = (recipe: (draft: CanvasDocument) => void) => {
    const [next, patches, inversePatches] = createMutative(snapshot(), recipe, {
      enablePatches: true,
    });

    if (patches.length === 0) return;

    /**
     * 新操作产生后，旧的 redo 分支必须清空。
     * 例：撤销两步后又添加了新矩形，此时原来的“下一步”已经不再成立。
     */
    past = [...past, { patches, inversePatches }].slice(-HISTORY_LIMIT);
    future = [];
    set(sync(next));
  };

  return {
    ...sync(initialDocument),
    addPage() {
      commit((draft) => {
        const page = createPage();

        draft.pages[page.id] = page;
        draft.pageIds.push(page.id);
        draft.activePageId = page.id;
      });
    },
    addDrawLine(line) {
      commit((draft) => {
        const page = getActivePage(draft);

        serial += 1;

        const node: LineNode = {
          ...line,
          animationList: [],
          id: createId(),
          kind: "line",
          name: `笔迹 ${serial}`,
          transformOrigin: line.transformOrigin ?? "top-left",
        };

        page.nodeMap[node.id] = node;
        page.rootIds.push(node.id);
        page.selectedIds = [];
        page.activeId = undefined;
      });
    },
    addNode(kind) {
      commit((draft) => {
        const page = getActivePage(draft);
        const node = createNode(kind, page.rootIds.length);

        /** 新增节点默认放到当前页面根层级最上方，并立即作为当前选中节点。 */
        page.nodeMap[node.id] = node;
        page.rootIds.push(node.id);
        page.selectedIds = [node.id];
        page.activeId = node.id;
      });
    },
    applyEraserResult(deletedIds: string[], lineErasers: CanvasLineEraserUpdate[]) {
      if (deletedIds.length === 0 && lineErasers.length === 0) return;

      commit((draft) => {
        const page = getActivePage(draft);
        const deletedSet = new Set(deletedIds);

        /**
         * 普通图形仍然按整节点删除。
         * line 节点不走这里，因为 line 会追加 eraser 轨迹，只擦掉笔迹自身的一部分。
         */
        deletedIds.forEach((id) => {
          removeNodeFromPage(page, id);
        });

        lineErasers.forEach(({ id, points, strokeWidth }) => {
          const node = page.nodeMap[id];

          if (!node || node.kind !== "line" || points.length < 2) return;

          /**
           * Leafer 的 eraser 只作用在同一个 Group 内的下层兄弟元素。
           * 因此这里不拆分 line，也不画白色遮挡层，只把本次擦除轨迹记录到 line 节点自己身上。
           */
          node.eraserPaths = [...(node.eraserPaths ?? []), { points: [...points], strokeWidth }];
        });

        /**
         * 橡皮擦操作本身不产生选区。
         * 如果擦掉的是当前选中的节点，这里同步清理 activeId / selectedIds。
         */
        page.selectedIds = page.selectedIds.filter((id) => !deletedSet.has(id));
        page.activeId = page.selectedIds.at(-1);
      });
    },
    bringForward(id = get().activePage.activeId) {
      if (!id) return;

      commit((draft) => {
        const page = getActivePage(draft);
        const node = page.nodeMap[id];
        const layerIds = getLayerIds(page, node?.parentId);
        const index = layerIds.indexOf(id);

        /** 已经在当前同级列表最顶层时，不产生历史记录。 */
        if (index === -1 || index === layerIds.length - 1) return;

        /** 图层顺序由 id 数组决定：越靠后越在上层。 */
        layerIds.splice(index, 1);
        layerIds.splice(index + 1, 0, id);
      });
    },
    groupSelected() {
      commit((draft) => {
        const page = getActivePage(draft);
        const siblingIds = getSelectedSiblingIds(page);

        /** 只有两个及以上同父级节点才可以组成一个 group。 */
        if (siblingIds.length < 2) return;

        serial += 1;

        const first = page.nodeMap[siblingIds[0]];
        const selectedNodes = siblingIds
          .map((id) => page.nodeMap[id])
          .filter((node): node is CanvasNode => Boolean(node));
        const groupId = createId();
        const layerIds = getLayerIds(page, first.parentId);
        const selectedSet = new Set(siblingIds);
        const bounds = getGroupBounds(selectedNodes);
        /** 新 group 会插入到被选中节点中最靠下的那个位置，尽量保持原图层位置稳定。 */
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

        /**
         * 子节点仍然保存在 nodeMap 里，只是 parentId 改成新 group。
         * group.childrenIds 保存这些子节点在组内的图层顺序。
         */
        siblingIds.forEach((id) => {
          const child = page.nodeMap[id];

          child.parentId = groupId;
          child.x -= bounds.x;
          child.y -= bounds.y;
        });

        page.nodeMap[groupId] = groupNode;
        /** 先从当前同级图层列表里移除被打组的节点。 */
        layerIds.splice(0, layerIds.length, ...layerIds.filter((id) => !selectedSet.has(id)));
        /** 再把 group 节点放回原来的位置。 */
        layerIds.splice(firstIndex, 0, groupId);
        page.selectedIds = [groupId];
        page.activeId = groupId;
      });
    },
    redo() {
      const entry = future.at(-1);

      if (!entry) return;

      /** redo 会消费 future 顶部记录，并把它重新放回 past。 */
      future = future.slice(0, -1);
      past = [...past, entry].slice(-HISTORY_LIMIT);
      set(sync(apply(snapshot(), entry.patches)));
    },
    reset() {
      /** reset 是明确的清空动作，不进入历史；它会同时清掉 undo / redo 栈。 */
      past = [];
      future = [];
      set(sync(initialDocument));
    },
    removeNode(id) {
      commit((draft) => {
        const page = getActivePage(draft);

        removeNodeFromPage(page, id);
      });
    },
    removeNodes(ids) {
      if (ids.length === 0) return;

      commit((draft) => {
        const page = getActivePage(draft);

        ids.forEach((id) => {
          removeNodeFromPage(page, id);
        });
      });
    },
    selectPage(id) {
      const document = snapshot();

      if (!document.pages[id] || document.activePageId === id) return;

      set(sync({ ...document, activePageId: id }));
    },
    selectNode(id, additive = false) {
      const page = get().activePage;

      if (!id) {
        /** 传空 id 表示清空当前页面选择。 */
        set(sync(updateActivePage(snapshot(), { activeId: undefined, selectedIds: [] })));
        return;
      }

      if (!page.nodeMap[id]) return;

      if (!additive) {
        /** 普通点击：单选当前节点。 */
        set(sync(updateActivePage(snapshot(), { activeId: id, selectedIds: [id] })));
        return;
      }

      /** Ctrl / Shift 点击：切换当前节点是否在多选集合中。 */
      const selectedSet = new Set(page.selectedIds);

      if (selectedSet.has(id)) {
        selectedSet.delete(id);
      } else {
        selectedSet.add(id);
      }

      const selectedIds = [...selectedSet];

      set(sync(updateActivePage(snapshot(), { activeId: id, selectedIds })));
    },
    selectNodes(ids) {
      const page = get().activePage;
      const validIds = ids.filter((id) => Boolean(page.nodeMap[id]));

      if (isSameIdList(page.selectedIds, validIds)) return;

      set(
        sync(
          updateActivePage(snapshot(), {
            activeId: validIds.at(-1),
            selectedIds: validIds,
          }),
        ),
      );
    },
    sendBackward(id = get().activePage.activeId) {
      if (!id) return;

      commit((draft) => {
        const page = getActivePage(draft);
        const node = page.nodeMap[id];
        const layerIds = getLayerIds(page, node?.parentId);
        const index = layerIds.indexOf(id);

        /** 已经在当前同级列表最底层时，不产生历史记录。 */
        if (index <= 0) return;

        /** 图层顺序由 id 数组决定：越靠前越在下层。 */
        layerIds.splice(index, 1);
        layerIds.splice(index - 1, 0, id);
      });
    },
    undo() {
      const entry = past.at(-1);

      if (!entry) return;

      /** undo 会消费 past 顶部记录，并把它放入 future，供 redo 恢复。 */
      past = past.slice(0, -1);
      future = [...future, entry].slice(HISTORY_LIMIT * -1);
      set(sync(apply(snapshot(), entry.inversePatches)));
    },
    ungroupSelected() {
      commit((draft) => {
        const page = getActivePage(draft);
        /** 支持一次拆开多个已选 group。 */
        const groupIds = page.selectedIds.filter((id) => page.nodeMap[id]?.kind === "group");

        if (groupIds.length === 0) return;

        const nextSelectedIds: string[] = [];

        groupIds.forEach((groupId) => {
          const group = page.nodeMap[groupId];

          if (!group || group.kind !== "group") return;

          const layerIds = getLayerIds(page, group.parentId);
          const index = layerIds.indexOf(groupId);

          if (index === -1) return;

          /**
           * 子节点 parentId 恢复为 group 原来的父级；
           * 如果 group 在根层级，子节点 parentId 也会变回 undefined。
           */
          group.childrenIds.forEach((childId) => {
            const child = page.nodeMap[childId];

            child.parentId = group.parentId;
            child.x += group.x;
            child.y += group.y;
          });
          /** 在原位置用子节点列表替换 group 节点，保持拆组前后视觉层级尽量稳定。 */
          layerIds.splice(index, 1, ...group.childrenIds);
          nextSelectedIds.push(...group.childrenIds);
          delete page.nodeMap[groupId];
        });

        page.selectedIds = nextSelectedIds;
        page.activeId = nextSelectedIds.at(-1);
      });
    },
    updateNode(id, data) {
      commit((draft) => {
        const page = getActivePage(draft);
        const node = page.nodeMap[id];

        /**
         * 元素和 group 都允许更新基础变换属性。
         * group 的 childrenIds / kind / id 这类结构字段不能从属性面板随意覆盖，
         * 否则会破坏 nodeMap + 图层列表之间的引用关系。
         */
        if (!node) return;

        Object.assign(node, data);
      });
    },
    updateNodes(updates: CanvasNodeUpdate[]) {
      if (updates.length === 0) return;

      commit((draft) => {
        const page = getActivePage(draft);

        /**
         * 多选拖拽会一次改动多个 Leafer UI。
         * 这里把这些 UI 的最新坐标一起写回 store，避免切页后从旧数据重建导致位置回退。
         */
        updates.forEach(({ data, id }) => {
          const node = page.nodeMap[id];

          if (!node) return;

          Object.assign(node, data);
        });
      });
    },
  };
});
