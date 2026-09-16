# 预览页（Preview）实现规划

> 目标：新增一个预览/演示页，把 `home` 制作的多页画布原样展示出来，支持画笔批注、橡皮擦、一键清除批注、动画播放，以及演示设置。
> 核心约束（已与用户确认）：**预览页对制作内容只读，不可编辑；只有画笔/橡皮擦产生的「批注」可写**。

## 1. 关键设计决策

### 1.1 数据源：本地副本，不污染 home 文档
- 预览页挂载时从 `useCanvasStore.getState()` 读取当前文档，用 `structuredClone` 生成一份**本地副本**，由预览页自己用 `useState` 持有（不进全局 store）。
- 制作内容（矩形、文本、图片、production `line` 等）在本副本里**只读**，不会被拖动、编辑、删除。
- 画笔/橡皮擦产生的变更只写回本地副本；“清除批注”只删本地副本里的批注节点。
- 离开预览页时本地副本随组件卸载丢弃，home 文档保持原样。这正好满足“复制 home 制作的页面进行预览”。

### 1.2 渲染引擎直接复用 `useLeaferCanvas`
- `useLeaferCanvas` 已经完全由 `page` + `tool` + 一堆回调驱动，自身不读 store。因此预览页只需传入：
  - `page`：本地副本的当前页（React state，批注变化时生成新对象触发增量同步）；
  - `tool`：预览页自己的工具状态（含 `brushColor`）；
  - 回调：`onAddDrawLine` / `onApplyEraserResult` 写本地副本；`onSelectNode` / `onSelectNodes` / `onUpdateNode` / `onUpdateNodes` 全部置为 no-op（因为 readOnly）。
- 这样 home 的全部画布引擎（缩放、标尺、节点渲染、图片缓存、动画、画笔、橡皮擦）**零改动复用**。

### 1.3 批注层与“一键清除”
- 画笔产生的笔迹在 store 里已带 `source: "brush"`（`canvasStore.addDrawLine` 写死）。预览页的 `onAddDrawLine` 也沿用这一标识。
- “一键清除笔记”：删除本地副本里所有 `source === "brush"` 的节点（同时清掉它们的 `eraserPaths` 引用与图层顺序）。不碰任何 production 节点。

### 1.4 只读模式（readOnly）
- 给 `UseLeaferCanvasOptions` 增加可选 `readOnly?: boolean`。开启时：
  - `useToolInteractivity`：所有节点强制 `editable = false`、`draggable = false`（即使将来误用 select 模式也不会被拖动）。
  - `useLeaferApp`：跳过 `DragEvent.END` 的位置回写与 `EditorEvent.SELECT` 的写回（预览不需要选区回写）。
  - 预览页工具模式只暴露 `brush` / `eraser` / `magnifier`，不暴露 `select`（无编辑语义）。

### 1.5 橡皮擦只擦批注
- 现状：`useEraserTool` 的 `erasable` 用 `isErasableLineTarget`，会擦**所有** `line` 节点（含 production 线条）。
- 预览页要只擦自己的批注：给 `UseLeaferCanvasOptions` 增加可选 `erasableFilter?: (target) => boolean`，默认仍是 `isErasableLineTarget`；预览页额外叠加 `nodeMap[id]?.source === "brush"` 判断。

### 1.6 画笔颜色
- `leafer-x-brush-eraser` 的 `Brush` 已支持 `stroke` 配置与 `brush.set({ stroke })`（见 `packages/leafer-x-brush-eraser/src/Brush.ts`）。
- `useBrushTool` 增加可选 `stroke` 透传；预览工具栏提供调色（默认红），home 不传则沿用插件默认色，行为不变。

### 1.7 动画播放
- 现状：节点创建/同步时把 `animationList` 写入 Leafer `animation`，Leafer 在 UI 生成时自动播放一次（`syncNodeTree.ts`、`ui/animation.ts`）。
- 预览页“播放动画”= **重新从头播放当前页所有节点的动画**。实现：提供 `playAnimations()`，通过给 board 内所有节点 UI 重置 animation 签名（或整页重新同步）触发重播。另可支持“逐页自动播放”（演示设置里的页间隔）。
- 注意：`syncNodeTree` 为避免拖拽打断，只在 animation 签名变化时才重写；重播需主动让签名失效再恢复，或重建当前页 UI。

## 2. 可复用的 home/hooks（结论）

`useLeaferCanvas` 及其所有子 hook **几乎全部可直接复用**，因为它们都只依赖传入的 `page` / `tool` / 回调，不依赖 home 页面本身：

| Hook / 模块 | 复用方式 |
| --- | --- |
| `useLeaferCanvas`（入口） | 直接调用，传本地副本 page + 预览回调 |
| `core/useRuntime` | 直接复用（共享 refs） |
| `core/useLeaferApp` | 复用；readOnly 时跳过 select/drag 写回 |
| `core/useStageBoard` | 直接复用（缩放/居中/白板） |
| `core/useRuler` | 直接复用（演示时可选隐藏） |
| `core/useSnap` | 直接复用（readOnly 下拖拽不发生，无副作用） |
| `core/useMagnifier` | 直接复用（放大镜演示） |
| `tree/useNodeTreeSync` + `syncNodeTree` | 直接复用（增量同步本地副本） |
| `tree/useToolInteractivity` | 复用；readOnly 时强制不可编辑/拖动 |
| `selection/useEditorSelection` | readOnly 时关闭选区写回 |
| `tools/usePointerTools` / `useBrushTool` / `useEraserTool` | 复用；增加 `brushColor`、`erasableFilter` 可选参数 |
| `tools/lineNodeInput` / `eraserUpdates` / `additiveSelect` | 直接复用（擦除新增 source 过滤） |
| `ui/*`（nodeUi、lineUi、imageUi、animation、uiMap、paint） | 直接复用 |
| `geometry/boardLayout` + `home/canvasFit`（`getCanvasViewSize`） | 直接复用（视图尺寸换算） |

**不可直接复用 / 需新建的部分：**
- `components/CanvasToolbar`：home 专属（含保存、撤销重做）。预览页新建 `PreviewToolbar`（画笔/橡皮粗细、画笔颜色、清除批注、播放动画、演示设置入口）。
- `MaterialPanel` / `PropertyPanel` / `PageThumbnailStrip` / `CanvasContextMenu`：home 编辑面板，预览页不需要（页面切换走底部的演示控制条或键盘）。
- 路由：在 `src/router/index.tsx` 增加 `/preview`。

## 3. 改动清单

1. **类型** `src/types/leafer/index.ts`：`UseLeaferCanvasOptions` 增加 `readOnly?`、`erasableFilter?`、`tool.brushColor?`。
2. **`core/useLeaferApp.ts`**：`readOnly` 时跳过 `DragEvent.END` 与 `EditorEvent.SELECT` 写回。
3. **`tree/useToolInteractivity.ts`**：`readOnly` 时所有节点 `editable/draggable = false`。
4. **`selection/useEditorSelection.ts`**：`readOnly` 时直接 return（不调 `editor.select`）。
5. **`tools/useBrushTool.ts`**：透传可选 `stroke`（画笔颜色）。
6. **`tools/useEraserTool.ts`**：`erasable` 优先用传入的 `erasableFilter`，否则回退 `isErasableLineTarget`。
7. **新增预览页**：
   - `src/pages/preview/index.tsx`：加载本地副本 → 调 `useLeaferCanvas` → 渲染 `PreviewToolbar` + 画布。
   - `src/pages/preview/PreviewToolbar`（新组件）。
   - `src/pages/preview/usePreviewDocument.ts`（本地副本 state + `addDrawLine` / `applyEraserResult` / `clearNotes` / `playAnimations`）。
8. **路由** `src/router/index.tsx`：增加 `preview` 路由，并在 home 顶部或导航提供入口。

## 4. 实现步骤（建议顺序）

1. 类型与 4 个 hook 的可选参数（`readOnly` / `erasableFilter` / `brushColor`）。
2. `usePreviewDocument`：克隆文档、维护当前页、批注增删与清除。
3. `preview/index.tsx` 接线 `useLeaferCanvas`（先只渲染、画笔可画）。
4. `PreviewToolbar`：工具切换、粗细、颜色、清除、播放。
5. readOnly 接线（禁用编辑/选区写回）；橡皮擦只擦批注。
6. 动画播放 + 演示设置（页间隔自动播放、标尺显隐、全屏）。
7. 路由与入口。

## 5. 测试（按 AGENTS.md 要求）

- `preview/index.test.tsx`：挂载不崩、只读模式下画笔产生 `source:"brush"` 批注、清除批注只剩 production、`erasableFilter` 只擦批注不擦 production line、动画播放触发 UI 重播。
- `usePreviewDocument` 单测：克隆不污染原文档、clearNotes 行为、applyEraserResult 行为。
- 上述 4 个 hook 的可选参数分支补用例（readOnly 时不回写、erasableFilter 生效）。

## 6. 待确认问题

- **演示设置范围**：是否包含“逐页自动播放+页间隔”“全屏”“标尺显隐”“画笔默认颜色/粗细预设”？先按最小集（画笔颜色、粗细、清除、播放、页切换）实现，其余可后续加。
- **动画播放形态**：只“重播当前页”，还是“自动按页顺序 + 间隔播放整份演示”？建议两者都给（单页重播按钮 + 演示设置里的自动轮播）。
- **页面切换交互**：预览页底部放一个简版页码切换条（读副本的 `pageIds`），是否足够，还是直接用键盘左右键？
