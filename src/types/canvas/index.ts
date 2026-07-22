import type { Patch } from "mutative";
import type { CanvasMaterialKind, CanvasNode, LineNode } from "../elementNode";

/** 当前画布交互工具。 */
export type CanvasToolMode = "select" | "brush" | "eraser";

/** 画布固定设计尺寸。DOM 会等比缩放，数据始终按这个坐标系存储。 */
export interface CanvasViewport {
  /** 画布设计宽度，当前按 1920 设计。 */
  width: number;
  /** 画布设计高度，当前按 1080 设计。 */
  height: number;
}

/** 单页画布状态。 */
export interface CanvasPage {
  /** 页面唯一 ID。 */
  id: string;
  /** 页面名称，用于底部缩略图和后续页面管理。 */
  name: string;
  /** 固定画布尺寸，当前默认 1920 x 1080。 */
  viewport: CanvasViewport;
  /** 所有节点字典，key 是节点 ID。 */
  nodeMap: Record<string, CanvasNode>;
  /** 根层级节点 ID 列表，顺序就是根图层顺序。 */
  rootIds: string[];
  /** 当前选中的节点 ID 列表，支持多选。 */
  selectedIds: string[];
  /** 主选中节点 ID，属性面板展示它。 */
  activeId?: string;
}

/** 多页画布文档状态。 */
export interface CanvasDocument {
  /** 当前正在编辑的页面 ID。 */
  activePageId: string;
  /** 页面字典，key 是页面 ID。 */
  pages: Record<string, CanvasPage>;
  /** 页面顺序，底部缩略图按此顺序展示。 */
  pageIds: string[];
}

/** 一次可撤销操作。 */
export interface CanvasHistoryEntry {
  /** 正向 patches，用于重做。 */
  patches: Patch[];
  /** 反向 patches，用于撤销。 */
  inversePatches: Patch[];
}

/** 撤销/重做历史状态。 */
export interface CanvasHistoryState {
  /** 撤销栈，保存过去操作。 */
  past: CanvasHistoryEntry[];
  /** 重做栈，保存被撤销后可恢复的操作。 */
  future: CanvasHistoryEntry[];
  /** 最大历史步数。 */
  limit: number;
}

/** 单个节点的批量更新描述，用于一次性提交多节点变更。 */
export interface CanvasNodeUpdate {
  /** 要更新的节点 ID。 */
  id: string;
  /** 要合并到节点上的属性。 */
  data: Partial<CanvasNode>;
}

/** 画布 store 对外暴露的状态和动作。 */
export interface CanvasStore extends CanvasDocument {
  /** 当前正在编辑的页面，派生自 activePageId。 */
  activePage: CanvasPage;
  /** 当前选择是否满足打组条件；只有同父级的多个节点才能打组。 */
  canGroup: boolean;
  /** 是否存在可重做历史。 */
  canRedo: boolean;
  /** 当前选择中是否包含组节点。 */
  canUngroup: boolean;
  /** 是否存在可撤销历史。 */
  canUndo: boolean;
  /** 新增一个空白页面，并切换到新页面。 */
  addPage(): void;
  /** 添加一条自由绘制笔迹。 */
  addDrawLine(line: Omit<LineNode, "id" | "name">): void;
  /** 添加一个根层级节点，并自动选中新节点。 */
  addNode(kind: CanvasMaterialKind): void;
  /** 将节点在同级图层中上移一层。 */
  bringForward(id?: string): void;
  /** 将当前同父级的多选节点包进一个 group 节点。 */
  groupSelected(): void;
  /** 重做最近一次撤销操作。 */
  redo(): void;
  /** 重置文档和历史栈。 */
  reset(): void;
  /** 删除节点；橡皮擦和后续删除命令共用这个动作。 */
  removeNode(id: string): void;
  /** 批量删除节点，并作为一次历史记录提交。 */
  removeNodes(ids: string[]): void;
  /** 切换当前编辑页面。 */
  selectPage(id: string): void;
  /** 选择节点；additive 为 true 时用于 Ctrl/Shift 多选切换。 */
  selectNode(id?: string, additive?: boolean): void;
  /** 用编辑器框选结果直接覆盖当前选区，ids 顺序会决定属性面板的主选中节点。 */
  selectNodes(ids: string[]): void;
  /** 将节点在同级图层中下移一层。 */
  sendBackward(id?: string): void;
  /** 拆开当前选中的组，并把子节点放回组原来的同级位置。 */
  ungroupSelected(): void;
  /** 撤销最近一次可记录操作。 */
  undo(): void;
  /** 更新节点属性，进入历史栈；元素和 group 的基础字段都通过这里写入。 */
  updateNode(id: string, data: Partial<CanvasNode>): void;
  /** 批量更新节点属性，并作为一次历史记录提交。 */
  updateNodes(updates: CanvasNodeUpdate[]): void;
}
