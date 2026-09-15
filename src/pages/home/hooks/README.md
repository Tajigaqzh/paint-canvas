# Home Hooks 结构说明

`hooks` 目录承载 Home 页面中和 Leafer 画布绑定最紧的逻辑。当前核心入口是
`useLeaferCanvas.ts`，它只负责组装子模块，不再直接包含大量节点渲染、指针事件和
命中检测细节。增量同步为什么不能 `app.tree.clear()`、选区如何防回环，见
`docs/useLeaferCanvas-logic.md`。

## 目录结构

```text
hooks/
  README.md
  useLeaferCanvas.ts
  leaferCanvas/
    core/
      useLeaferApp.ts
      useMagnifier.ts
      useRuler.ts
      useRuntime.ts
      useSnap.ts
      useStageBoard.ts
    geometry/
      boardLayout.ts
    selection/
      useEditorSelection.ts
    tools/
      additiveSelect.ts
      eraserUpdates.ts
      lineNodeInput.ts
      useBrushTool.ts
      useEraserTool.ts
      usePointerTools.ts
    tree/
      syncNodeTree.ts
      useNodeTreeSync.ts
      useToolInteractivity.ts
    ui/
      animation.ts
      imageUi.ts
      lineUi.ts
      nodeUi.ts
      paint.ts
      uiMap.ts
```

## 分层职责

```mermaid
flowchart TD
  Entry[useLeaferCanvas.ts<br/>统一入口] --> Core[core<br/>共享 refs、App、舞台、吸附]
  Entry --> Tree[tree<br/>节点树增量同步]
  Entry --> Tools[tools<br/>画笔、橡皮擦]
  Entry --> Selection[selection<br/>选区同步]

  Core --> Types[src/types/leafer]
  Tree --> UI[ui<br/>节点 UI 构造、样式和动画映射]
  Core --> Geometry[geometry<br/>画板布局和命中检测]
  Tools --> Geometry
  Tools --> UI
  Selection --> Types
  UI --> Types
  Geometry --> Types
```

### `useLeaferCanvas.ts`

这是对外唯一入口，Home 页面仍然通过：

```ts
import { useLeaferCanvas } from "./hooks/useLeaferCanvas";
```

入口职责：

- 解构当前页面的 `nodeMap`、`rootIds`、`selectedIds`、`viewport`。
- 调用 `useRuntime` 创建共享 refs。
- 组装 `useLeaferApp`、`useStageBoard`、`useNodeTreeSync`、`usePointerTools`、`useToolInteractivity`、`useEditorSelection`。
- 组装三个插件接线：`useRuler`、`useSnap`、`useMagnifier`，它们只做「宿主状态 ↔ 插件命令式 API」的双向同步。
- 保持 `Home` 组件不感知内部拆分细节。

## `core`

`core` 负责共享 refs、Leafer 实例生命周期、画布变换，以及挂在 App 上的第三方插件（标尺、吸附）。

```mermaid
flowchart LR
  Runtime[useRuntime] --> App[useLeaferApp]
  Runtime --> Stage[useStageBoard]
  Runtime --> Snap[useSnap]
  Runtime --> Ruler[useRuler]
  Runtime --> Magnifier[useMagnifier]
  App --> LeaferApp[LeaferApp / Editor]
  Stage --> TreeNode["app.tree: 等比缩放 + 居中"]
  Stage --> BoardNode[board: 1920 x 1080 白色画板]
  TreeNode --> Ruler
  BoardNode --> Snap
```

### `useRuntime.ts`

创建所有子模块共享的稳定 refs：

- `appRef`：LeaferApp 实例。
- `boardRef`：稳定白板容器；画布缩放和居中直接写在 `app.tree` 上。
- `isSyncingEditorSelectionRef`：程序化 select/cancel 时屏蔽 SELECT 回写。
- `pageRef` / `toolRef`：供原生事件读取最新 React 状态。
- `uiMapRef` / `uiKindMapRef` / `uiParentMapRef`：业务节点到 Leafer UI 的增量同步索引。
- `onAddDrawLineRef` 等 callback refs：避免原生事件闭包捕获旧 store action。

### `useLeaferApp.ts`

负责创建和销毁 LeaferApp，并注册只需要绑定一次的原生事件：

- `EditorEvent.SELECT`：用户点击、框选后同步回 store；UI 反查 nodeId 走 `ui/uiMap.ts`。
- `DragEvent.END`：拖拽结束后把 UI 上的最新位置写回 store。
- `InnerEditorEvent.CLOSE`：文本编辑关闭后同步文本内容。
- 卸载时 `disposeAllImageSources`，再 `app.destroy()`，并清空 uiMap 等索引。

### `useStageBoard.ts`

维护画布变换和 `board`：

- 等比缩放和居中挂在 `app.tree` 上，偏移来自 `geometry/boardLayout.ts`，与指针反算同一套公式。
- `board` 是 1920 x 1080 白色业务画板，自身不缩放；描边、圆角、投影按屏幕像素给，写进 Leafer 前除以显示缩放。
- 尺寸变化只调用 `set()`，不清空 `app.tree`，避免破坏 Editor 内部层。
- 变换变化后下一帧刷新 Editor 选区框。

### `useRuler.ts`

接入 `leafer-x-ruler`，画布视图左上角的标尺：

- 刻度条宽度取 `geometry/boardLayout.ts` 的 `BOARD_INSET`，白板会让出这块空间，不会被刻度条压住。
- 刻度按 `app.tree.scale` 反向换算，所以显示的是 1920×1080 业务坐标，不是屏幕像素。
- 标尺层盖在整个视图上，创建后要把 `rulerLeafer.canvas.hittable` 关掉，否则会挡住 Leafer Editor 的点击和拖拽。

### `useSnap.ts`

接入 `leafer-x-easy-snap`，负责 select 模式拖拽节点时的对齐参考线和自动吸附：

- `parentContainer` 必须传 `board`：插件只收集 `[parentContainer, ...parentContainer.children]`，不递归，传 app.tree 就只剩 board 一个候选元素。
- 插件用 `getBounds('box', app.tree)` 取包围盒，量出来是 tree 局部坐标（= 画板像素），所以 `snapSize` 要按 `app.tree.scale` 换算成屏幕像素。
- 辅助线由插件画到 `app.sky`，不进入 `board.children`，不影响节点增量同步。
- 只有 select 模式能拖节点，其它工具直接 `enable(false)`，避免多挂一组 editor / pointer 监听。

## `tree`

`tree` 负责把业务节点树同步成 Leafer UI 树。

```mermaid
flowchart TD
  Store[CanvasPage<br/>nodeMap + rootIds] --> Hook[useNodeTreeSync]
  Hook --> Sync[syncNodeTree]
  Sync --> Create[新增缺失 UI]
  Sync --> Update[已有 UI 调 set]
  Sync --> Move[父级或顺序变化时移动 UI]
  Sync --> Remove[删除不可达 UI]
  Sync --> Group[group childrenIds 递归同步]
```

### `useNodeTreeSync.ts`

hook 只在 `board` 就绪后调用 `syncCanvasPageToLeafer`。核心原则：

- 新增节点只创建对应 UI。
- 已有节点只更新属性，不重建整个画布。
- `rootIds` / `childrenIds` 顺序变化只移动 UI。
- group / ungroup 只移动父容器。
- 不再使用 `app.tree.clear()`。

### `syncNodeTree.ts`

增量同步的纯逻辑：创建 / `set` / 换父级 / 按 index 重排 / 销毁不可达 UI。事件闭包只捕获 `nodeId`，拖拽结束从 `pageRef` 读最新节点。

### `useToolInteractivity.ts`

根据工具模式切换节点可编辑性：

- `select`：恢复 `editable` 和 `draggable`，交给 Leafer Editor。
- `brush` / `eraser`：关闭 `editable` 和 `draggable`，避免 Editor hover 框和自定义工具冲突。

## `tools`

`tools` 负责自定义工具交互。

```mermaid
sequenceDiagram
  participant User as 用户指针
  participant DOM as canvas DOM
  participant Tools as usePointerTools
  participant Store as canvasStore
  participant Leafer as Leafer UI

  User->>DOM: pointerdown
  DOM->>Tools: boardLayout 换成业务坐标
  alt brush
    Tools->>Leafer: 创建临时 Line
    User->>Tools: pointermove
    Tools->>Leafer: 更新临时 points
    User->>Tools: pointerup
    Tools->>Store: addDrawLine
  else eraser
    Tools->>Tools: 插件内按 Leafer 选择器命中 line
    Tools->>Leafer: 命中 line 后更新 eraser 预览
    User->>Tools: pointerup
    Tools->>Store: applyEraserResult
  end
```

### `usePointerTools.ts`

组合 `leafer-x-brush-eraser` 的两个工具，只做「插件事件 -> store action」和「工具模式 -> 插件开关」。

- 手势采样、临时预览、命中检测都在插件里，制作页不再自己监听 pointer。
- 两个插件都需要 `board` 当坐标空间和预览容器，所以 `usePointerTools` 必须晚于 `useStageBoard`。
- `select` / `magnifier` 模式下两个插件都 `enabled = false`，不会接管手势。

### `useBrushTool.ts`

创建 `Brush` 插件，把 `draw` 事件经 `lineNodeInput.ts` 转成 `store.addDrawLine` 的输入，并按模式 / 粗细同步插件状态。

### `useEraserTool.ts`

创建 `Eraser` 插件，`erasable` 限定只擦 line 节点；监听 `end`（一次手势结束），把轨迹经 `eraserUpdates.ts` 转成 `store.applyEraserResult` 的入参，一次手势只提交一条历史。

### `lineNodeInput.ts`

笔迹事件 -> `LineNode` 输入：补上 `kind`、`animationList`、`curve`、`strokeCap` 等业务字段，几何和描边原样透传。

### `eraserUpdates.ts`

擦除轨迹 -> 节点级 eraser 更新：

- `isErasableLineTarget`：命中项（line group 内部的图形子节点）先按父级反查业务节点，只有 `kind === "line"` 才允许擦。
- `getLineEraserUpdates`：把轨迹按 `container`（line group）反查成 `{ id, points, strokeWidth }`。

### `additiveSelect.ts`

### `additiveSelect.ts`

判断点击是否追加/切换选择（Ctrl / Meta / Shift），兼容 Leafer 事件字段和 `origin` 上的 DOM 修饰键。节点 UI 的 `tap`（`syncNodeTree`）会用到它，不只是工具栏。

## `geometry`

`geometry` 是纯算法层，不依赖 React。

```mermaid
flowchart LR
  Client[浏览器 client 坐标] --> Layout[getBoardLayout / mapClientPointToBoard]
  Layout --> Point[业务坐标点]
  Point --> Store[store 节点坐标 / 拖放落点]
```

橡皮擦的命中不再走这里：它由 `leafer-x-brush-eraser` 内部用 Leafer 选择器完成，
制作页只用 `eraserUpdates.isErasableLineTarget` 做「是不是 line 节点」的过滤。

### `boardLayout.ts`

画布缩放居中和指针反算共用：

- `getBoardLayout`：按容器宽高算出 `scale`、`boardX`、`boardY`。
- `mapClientPointToBoard`：client 坐标换成画板坐标；落在白板外返回 `undefined`。

改缩放规则只改这里，避免舞台和画笔对不齐。

## `ui`

`ui` 负责把业务节点转换成 Leafer UI。

```mermaid
flowchart TD
  CanvasNode[CanvasNode] --> NodeInput[getNodeUIInput]
  CanvasNode --> Paint[getNodePaintInput]
  NodeInput --> Create[createNodeUI]
  Paint --> Create
  Create --> LeaferUI[Rect / Text / Ellipse / Line Group / Polygon / Star]
  LineNode[LineNode] --> LineUI[lineUi]
  LineUI --> Content[原始 Line]
  LineUI --> Eraser[eraser 子 Line]
```

### `paint.ts`

集中处理通用绘制属性：

- `fill`
- `stroke`
- `strokeWidth`
- `strokeCap`
- `strokeAlign`
- `dashPattern`

### `animation.ts`

把节点 `animationList` 转成 Leafer `animation`：

- 面板时长/延时是毫秒，Leafer 使用秒。
- 多条动画按列表顺序依次开始。
- 创建节点时写入 animation；后续增量同步只有配置变化才重写，避免拖拽打断播放。

### `nodeUi.ts`

处理节点级映射：

- `getNodeUIInput`：业务节点字段到 Leafer 输入字段。
- `createNodeUI`：按节点类型创建 Leafer UI。
- `getNodePatchFromUI`：拖拽/编辑后从 Leafer UI 反读可写回 store 的字段。
- `hasNodePatchChange`：避免空 patch 进入历史栈。

### `lineUi.ts`

line 节点单独处理，因为它需要局部擦除：

- line 业务节点在 Leafer 中渲染为 `Group`。
- 原始笔迹是 group 内的底层 `Line`。
- eraser 轨迹是 group 内的上层 `Line`，使用 Leafer 的 `eraser: "pixel"`。
- `eraserPaths` 会在同步时重建为持久 eraser 子节点。
- 场景标识：节点来源（`LineNode.source`）决定 className 前缀 —— 画笔笔迹是 `brush`（本体 `brush-path`、擦除轨迹 `brush-eraser`、占位 `brush-eraser-primer`），素材线条和没有该字段的老文档是 `line`。第三方遍历场景时靠它区分笔迹节点和内部渲染元素。

### `imageUi.ts`

图片节点走 `src/worker/image-cache`：`getImageBlob` → `createObjectURL` → Leafer `Image.url`。换 `src` 或销毁前先清空 url 再 `revokeObjectURL`。

### `uiMap.ts`

`findNodeIdByUI`：Editor 事件给的是 UI 实例，用托管 `uiMap` 反查业务 `nodeId`。

## `selection`

`selection` 负责 store 到 Leafer Editor 的选区同步。

```mermaid
sequenceDiagram
  participant Store as store.selectedIds
  participant Hook as useEditorSelection
  participant Map as uiMap
  participant Editor as Leafer Editor

  Store->>Hook: selectedIds 变化
  Hook->>Map: nodeId 映射为 UI
  Hook->>Editor: editor.select(selectedUIs)
  Hook->>Editor: 或 editor.cancel()
```

### `useEditorSelection.ts`

只处理一个方向：

```text
store.selectedIds -> Leafer Editor
```

反方向：

```text
Leafer Editor -> store.selectedIds
```

由 `core/useLeaferApp.ts` 中的 `EditorEvent.SELECT` 处理。这样可以避免选区同步逻辑互相嵌套。

## 数据流总览

```mermaid
flowchart TD
  Home[Home 组件] --> Entry[useLeaferCanvas]
  Entry --> Runtime[useRuntime]
  Runtime --> App[useLeaferApp]
  Runtime --> Stage[useStageBoard]
  Runtime --> Tree[useNodeTreeSync]
  Runtime --> Tool[usePointerTools]
  Runtime --> Magnifier[useMagnifier]
  Runtime --> Snap[useSnap]
  Runtime --> Ruler[useRuler]
  Runtime --> Mode[useToolInteractivity]
  Runtime --> Selection[useEditorSelection]

  Store[canvasStore / CanvasPage] --> Entry
  Tree --> UIMap[uiMap / uiKindMap / uiParentMap]
  UIMap --> Selection
  UIMap --> Tool
  UIMap --> App

  Tool --> Store
  App --> Store
  Selection --> Editor[Leafer Editor]
```

## 维护约定

- 新增节点类型时，优先改 `ui/nodeUi.ts`，必要时同步 `worker/page-thumbnail` 渲染逻辑。
- 图片节点：主画布 Leafer 和缩略图都通过 `src/worker/image-cache` 加载 `src`；素材面板只负责把 URL 写入节点，自己不请求图片。
- 橡皮擦命中规则：`erasable` 过滤放在 `tools/eraserUpdates.ts`，具体命中由插件用 Leafer 选择器完成。
- 改舞台缩放或指针坐标换算时，只改 `geometry/boardLayout.ts`。
- 等比缩放必须留在 `app.tree`：标尺按 `app.tree.scale` 校准刻度，挪到 `board` 或更内层标尺会按屏幕像素标注。
- 新增 Leafer 插件时先确认没有装出第二份 `@leafer-ui/core`；插件用 `pnpm.overrides` 复用同一份 core。
- 新增工具模式时，优先做成 `packages/leafer-x-*` 插件，再由 `usePointerTools` 组合接线（参考 `useBrushTool.ts`）。
- 通用画布交互能力优先做成 `packages/leafer-x-*` 插件：插件包内不出现 React / Vue / store，只提供命令式 API 与事件；`core/` 下的接线 hook 负责把宿主状态同步过去（参考 `useMagnifier.ts`）。
- 修改 App 生命周期或 Editor 原生事件时，只改 `core/useLeaferApp.ts`；共享 refs 只改 `core/useRuntime.ts`。
- Leafer hook / UI 运行时类型放在 `src/types/leafer`，不要在 `leaferCanvas` 下再建 `shared` 类型目录。
- 不要在任何模块里调用 `app.tree.clear()`；只维护本项目创建的 board / node UI。
- 原理和历史坑见 `docs/useLeaferCanvas-logic.md`；改完本目录结构后同步根 `README.md`。
