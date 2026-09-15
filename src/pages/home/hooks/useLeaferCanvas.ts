import { useLeaferApp } from "./leaferCanvas/core/useLeaferApp";
import { useRuler } from "./leaferCanvas/core/useRuler";
import { useRuntime } from "./leaferCanvas/core/useRuntime";
import { useSnap } from "./leaferCanvas/core/useSnap";
import { useStageBoard } from "./leaferCanvas/core/useStageBoard";
import { useEditorSelection } from "./leaferCanvas/selection/useEditorSelection";
import type { UseLeaferCanvasOptions } from "@/types";
import { useMagnifier } from "./leaferCanvas/core/useMagnifier";
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
 * 5. 画笔和橡皮擦是自定义 pointer 工具；放大镜是自定义 hover 工具；鼠标 cursor 图标由 Home 层 DOM 样式处理。
 *
 * 这个入口只负责组装各功能子模块：
 * 1. core：初始化 LeaferApp / Editor，并维护 stage 和 board。
 * 2. tree：按 nodeMap / rootIds 增量同步节点 UI。
 * 3. tools：接管 brush / eraser pointer 手势。
 * 4. selection：同步 store.selectedIds 到 Leafer Editor。
 * 5. core/useRuler、core/useSnap、core/useMagnifier：第三方插件接线，只做状态同步。
 */
export function useLeaferCanvas({
  magnifierContainerRef,
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
  // 共享 refs：LeaferApp、stage/board、uiMap、callback refs。
  const runtime = useRuntime({
    onAddDrawLine,
    onApplyEraserResult,
    onSelectNode,
    onSelectNodes,
    onUpdateNode,
    onUpdateNodes,
    page,
    tool,
  });

  // App 生命周期 + Editor 选择 / 拖拽 / 文本关闭事件。
  useLeaferApp({
    ...runtime,
    onUpdateNode,
    viewRef,
  });
  // brush / eraser 自定义 pointer 手势。
  usePointerTools({
    ...runtime,
    viewRef,
    viewSize,
  });
  // 放大镜：镜片由 leafer-x-magnifier 自己创建和绘制，这里只把工具状态同步过去。
  useMagnifier({
    appRef: runtime.appRef,
    magnifierContainerRef,
    tool,
    toolRef: runtime.toolRef,
  });
  // 等比缩放并居中的画布舞台 + 白色 board。
  useStageBoard({
    appRef: runtime.appRef,
    boardRef: runtime.boardRef,
    isSyncingEditorSelectionRef: runtime.isSyncingEditorSelectionRef,
    viewRef,
    viewSize,
    viewport,
  });
  // 画布左上角的标尺；必须在 useStageBoard 之后，app.tree 的缩放要先挂上去。
  useRuler({
    appRef: runtime.appRef,
  });
  // 节点拖拽时的对齐参考线和吸附；必须放在 useStageBoard 之后，board 要先建出来。
  useSnap({
    appRef: runtime.appRef,
    boardRef: runtime.boardRef,
    tool,
    viewSize,
  });
  // nodeMap / rootIds -> Leafer UI 增量同步。
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
  // select 可编辑；brush / eraser / magnifier 关闭 Editor 拖拽。
  useToolInteractivity({
    nodeMap,
    rootIds,
    tool,
    uiMapRef: runtime.uiMapRef,
  });
  // store.selectedIds -> editor.select / cancel。
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
