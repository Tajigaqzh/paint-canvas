import { useEffect } from "react";
import "@leafer-in/editor";
import "@leafer-in/text-editor";
import { EditorEvent, InnerEditorEvent } from "@leafer-in/editor";
import { App as LeaferApp, DragEvent, type IUI } from "leafer-ui";
import type { CanvasNodeUpdate } from "@/types";
import { getNodePatchFromUI, hasNodePatchChange } from "../ui/nodeUi";
import type {
  EditableLeaferApp,
  EditorSelectEvent,
  InnerEditorCloseEvent,
  LeaferEventTarget,
  UseLeaferCanvasOptions,
} from "../shared/types";
import type { useLeaferCanvasRuntime } from "./useLeaferCanvasRuntime";

type Runtime = ReturnType<typeof useLeaferCanvasRuntime>;

type UseLeaferAppParams = Pick<UseLeaferCanvasOptions, "onUpdateNode" | "viewRef"> & Runtime;

type SetupLeaferAppParams = Pick<
  UseLeaferAppParams,
  | "appRef"
  | "boardRef"
  | "isSyncingEditorSelectionRef"
  | "onSelectNodesRef"
  | "onUpdateNode"
  | "onUpdateNodesRef"
  | "pageRef"
  | "stageRef"
  | "viewRef"
> & {
  uiKindMap: Runtime["uiKindMapRef"]["current"];
  uiMap: Runtime["uiMapRef"]["current"];
  uiParentMap: Runtime["uiParentMapRef"]["current"];
};

/**
 * 创建 LeaferApp 并注册只需要绑定一次的 Leafer / Editor 原生事件。
 *
 * 这里不使用 React state，只通过 runtime refs 读取最新页面和 action，
 * 避免拖拽、框选、文本编辑等原生事件闭包捕获旧 store 快照。
 */
const setupLeaferApp = ({
  appRef,
  boardRef,
  isSyncingEditorSelectionRef,
  onSelectNodesRef,
  onUpdateNode,
  onUpdateNodesRef,
  pageRef,
  stageRef,
  uiKindMap,
  uiMap,
  uiParentMap,
  viewRef,
}: SetupLeaferAppParams) => {
  // DOM 容器还没挂载时不能创建 LeaferApp。
  if (!viewRef.current) return undefined;
  const app = new LeaferApp({
    // editor: {} 会让 @leafer-in/editor 插件初始化编辑器。
    editor: {},
    // App 底色是工作区灰色，白色画板由 board Frame 负责。
    fill: "#eef1f6",
    // Leafer 挂载到 Home 里的 .canvas-maker__canvas div。
    view: viewRef.current,
  }) as EditableLeaferApp;

  // 保存 app 实例，后续 effect 通过它增量同步 stage、节点和选区。
  appRef.current = app;
  /**
   * 根据 Leafer UI 反查业务节点 id。
   *
   * EditorEvent.SELECT 给的是 UI 实例，不知道业务 id。
   * uiMap 是本 hook 托管的 nodeId -> UI 索引，所以这里反向遍历得到 store 里的 id。
   */
  const getIdByUI = (target: IUI) => [...uiMap.entries()].find(([, ui]) => ui === target)?.[0];

  /**
   * 根据当前 Leafer UI 状态生成单个节点的更新描述。
   *
   * 拖拽结束时，Leafer UI 已经被移动，但 pageRef.current 还是 store 中的旧值。
   * 这个方法读取 UI 上的最新变换，和旧节点比较后，只在真的变化时返回 update。
   */
  const getNodeUpdate = (id: string): CanvasNodeUpdate | undefined => {
    const ui = uiMap.get(id);
    const node = pageRef.current.nodeMap[id];

    if (!ui || !node) return undefined;

    // Leafer 拖拽后，最新位置在 UI 实例上；store 里的 node 还是拖拽前的数据。
    const data = getNodePatchFromUI(ui, node);

    // 坐标没有变化就不提交，避免空操作进入撤销历史。
    return hasNodePatchChange(node, data) ? { data, id } : undefined;
  };
  /**
   * 把当前选中节点在 Leafer 中的最新变换批量写回 store。
   *
   * 多选拖拽时 Leafer 会同时修改多个 UI 的 x/y。
   * 这里收集所有真正变化的节点，一次性提交，保证撤销历史和缩略图更新都是一组操作。
   */
  const syncSelectedNodeTransforms = () => {
    // DragEvent.END 在 app 捕获阶段触发；这里只同步当前选区里真正移动过的节点。
    const selectedIds = pageRef.current.selectedIds;
    // 多选拖拽时，选区里的每个元素都可能被 Leafer 改了 x/y。
    // 这里统一收集后批量提交，让缩略图和切页重建都读到新位置。
    const updates = selectedIds
      .map((id) => getNodeUpdate(id))
      .filter((update): update is CanvasNodeUpdate => Boolean(update));

    onUpdateNodesRef.current(updates);
  };
  /**
   * 把 Leafer Editor 的选择结果同步回 store。
   *
   * 用户点击、框选、取消选择都会触发 EditorEvent.SELECT。
   * 代码主动调用 editor.select/cancel 也可能触发同一事件，所以需要用
   * isSyncingEditorSelectionRef 区分“用户选择”和“程序同步选择”。
   */
  const syncEditorSelection = (event: EditorSelectEvent) => {
    // 代码主动调用 editor.select/cancel 时也可能触发 SELECT，不能再写回 store。
    if (isSyncingEditorSelectionRef.current) return;

    // list 是常规来源，value 是兼容某些 Leafer 事件形态的兜底来源。
    const list =
      event.list ?? (Array.isArray(event.value) ? event.value : event.value ? [event.value] : []);
    const ids = list.map((item) => getIdByUI(item)).filter((id): id is string => Boolean(id));

    // 用户点击或框选产生的选择结果写回 store。
    onSelectNodesRef.current(ids);
  };

  // 框选、单选和取消选择都会通过这个事件同步回 store。
  app.editor?.on(EditorEvent.SELECT, syncEditorSelection);
  // 拖动结束统一检查选中节点位置，capture=true 让它能覆盖多选拖拽场景。
  (app as LeaferEventTarget).on?.(DragEvent.END, syncSelectedNodeTransforms, undefined, true);
  // 文本编辑完成后，把 Leafer 内部编辑器里的最终文本写回业务节点。
  app.editor?.on(InnerEditorEvent.CLOSE, (event: InnerEditorCloseEvent) => {
    const matched = [...uiMap.entries()].find(([, ui]) => ui === event.editTarget);

    if (!matched || event.editTarget?.text === undefined) return;

    onUpdateNode(matched[0], { text: String(event.editTarget.text) });
  });

  // 组件卸载或 viewRef 变化时销毁整个 LeaferApp 和所有托管索引。
  return () => {
    app.destroy();
    appRef.current = null;
    boardRef.current = null;
    stageRef.current = null;
    uiKindMap.clear();
    uiMap.clear();
    uiParentMap.clear();
  };
};

/**
 * 初始化 LeaferApp，并注册 Editor 选择、拖拽结束和文本编辑关闭事件。
 *
 * 这个 hook 只负责 App 生命周期和原生事件桥接；
 * 节点渲染、工具指针和选区显示分别由其它子 hook 处理。
 */
export const useLeaferApp = ({
  appRef,
  boardRef,
  isSyncingEditorSelectionRef,
  onSelectNodesRef,
  onUpdateNode,
  onUpdateNodesRef,
  pageRef,
  stageRef,
  uiKindMapRef,
  uiMapRef,
  uiParentMapRef,
  viewRef,
}: UseLeaferAppParams) => {
  const uiMap = uiMapRef.current;
  const uiKindMap = uiKindMapRef.current;
  const uiParentMap = uiParentMapRef.current;

  useEffect(() => {
    return setupLeaferApp({
      appRef,
      boardRef,
      isSyncingEditorSelectionRef,
      onSelectNodesRef,
      onUpdateNode,
      onUpdateNodesRef,
      pageRef,
      stageRef,
      uiKindMap,
      uiMap,
      uiParentMap,
      viewRef,
    });
  }, [
    appRef,
    boardRef,
    isSyncingEditorSelectionRef,
    onSelectNodesRef,
    onUpdateNode,
    onUpdateNodesRef,
    pageRef,
    stageRef,
    uiKindMap,
    uiKindMapRef,
    uiMap,
    uiMapRef,
    uiParentMap,
    uiParentMapRef,
    viewRef,
  ]);
};
