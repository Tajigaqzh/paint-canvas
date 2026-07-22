import { useLeaferApp } from "./leaferCanvas/core/useLeaferApp";
import { useLeaferCanvasRuntime } from "./leaferCanvas/core/useLeaferCanvasRuntime";
import { useStageBoard } from "./leaferCanvas/core/useStageBoard";
import { useEditorSelection } from "./leaferCanvas/selection/useEditorSelection";
import type { UseLeaferCanvasOptions } from "./leaferCanvas/shared/types";
import { usePointerTools } from "./leaferCanvas/tools/usePointerTools";
import { useNodeTreeSync } from "./leaferCanvas/tree/useNodeTreeSync";
import { useToolInteractivity } from "./leaferCanvas/tree/useToolInteractivity";

/**
 * useLeaferCanvas 是 React store 和 Leafer 命令式场景树之间的桥。
 *
 * 设计原则：
 * 1. store 里的 CanvasPage 是唯一真实数据源。
 * 2. Leafer UI 实例只是渲染缓存，按 nodeId 增量同步。
 * 3. Leafer Editor 的选择层是插件内部结构，不能用 app.tree.clear() 误清掉。
 * 4. 用户触发的选择事件可以写回 store，代码主动调用 editor.select() 时不能反向写回。
 * 5. 画笔和橡皮擦是自定义 pointer 工具；鼠标 cursor 图标由 Home 层 DOM 样式处理。
 *
 * 这个入口只负责组装各功能子模块：
 * 1. core：初始化 LeaferApp / Editor，并维护 stage 和 board。
 * 2. tree：按 nodeMap / rootIds 增量同步节点 UI。
 * 3. tools：接管 brush / eraser pointer 手势。
 * 4. selection：同步 store.selectedIds 到 Leafer Editor。
 */
export function useLeaferCanvas({
  onAddDrawLine,
  onApplyEraserResult,
  onSelectNode,
  onSelectNodes,
  onUpdateNode,
  onUpdateNodes,
  page,
  tool,
  viewRef,
  viewSize,
}: UseLeaferCanvasOptions) {
  const { nodeMap, rootIds, selectedIds, viewport } = page;
  const runtime = useLeaferCanvasRuntime({
    onAddDrawLine,
    onApplyEraserResult,
    onSelectNode,
    onSelectNodes,
    onUpdateNode,
    onUpdateNodes,
    page,
    tool,
  });

  useLeaferApp({
    ...runtime,
    onUpdateNode,
    viewRef,
  });
  usePointerTools({
    ...runtime,
    viewRef,
    viewSize,
  });
  useStageBoard({
    appRef: runtime.appRef,
    boardRef: runtime.boardRef,
    isSyncingEditorSelectionRef: runtime.isSyncingEditorSelectionRef,
    stageRef: runtime.stageRef,
    viewRef,
    viewSize,
    viewport,
  });
  useNodeTreeSync({
    appRef: runtime.appRef,
    boardRef: runtime.boardRef,
    isSyncingEditorSelectionRef: runtime.isSyncingEditorSelectionRef,
    nodeMap,
    onSelectNodeRef: runtime.onSelectNodeRef,
    onUpdateNodeRef: runtime.onUpdateNodeRef,
    pageRef: runtime.pageRef,
    rootIds,
    uiKindMapRef: runtime.uiKindMapRef,
    uiMapRef: runtime.uiMapRef,
    uiParentMapRef: runtime.uiParentMapRef,
  });
  useToolInteractivity({
    nodeMap,
    rootIds,
    tool,
    uiMapRef: runtime.uiMapRef,
  });
  useEditorSelection({
    appRef: runtime.appRef,
    isSyncingEditorSelectionRef: runtime.isSyncingEditorSelectionRef,
    nodeMap,
    rootIds,
    selectedIds,
    tool,
    uiMapRef: runtime.uiMapRef,
  });
}
