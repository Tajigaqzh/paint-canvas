# useLeaferCanvas 逻辑说明

`useLeaferCanvas` 是 React 状态和 Leafer 命令式画布之间的适配层。

React 这边的真实数据源是 `CanvasPage`，也就是 `nodeMap`、`rootIds`、`selectedIds`、`viewport`。Leafer 这边不是 React DOM，不能靠 JSX 自动 diff，所以 hook 需要把 store 里的数据主动同步到 Leafer 实例。

## 总体结构

```mermaid
flowchart TD
  Home[Home 组件] --> Store[canvasStore]
  Home --> Toolbar[CanvasToolbar: 工具和粗细]
  Toolbar --> Home
  Home --> Cursor[DOM cursor: 橡皮擦图标随 eraserSize 生成]
  Home --> Hook[useLeaferCanvas]
  Store --> Page[activePage: nodeMap / rootIds / selectedIds]
  Page --> Hook
  Hook --> App[LeaferApp]
  App --> Stage[stage: 缩放和居中容器]
  Stage --> Board[board: 1920 x 1080 白色画板]
  Board --> UI[Rect / Text / Ellipse / Line 等 Leafer UI]
  App --> Editor[Leafer Editor 选择框和编辑控件]
```

这里有两个层次：

- `stage / board / UI` 是我们自己渲染的画布内容。
- `Editor` 是 Leafer 插件自己的选择框、控制点、框选区域等内部层。
- `cursor` 是普通 DOM 样式，挂在 `.canvas-maker__canvas` 上，不进入 Leafer 场景树。

这两个层次不能混在一起清理。我们只维护自己的 `stage / board / UI`，不能把整个 `app.tree` 清空。

## Hook 里的几类 effect

```mermaid
flowchart LR
  A[初始化 effect] --> A1[创建 LeaferApp]
  A --> A2[注册 EditorEvent.SELECT]
  A --> A3[注册 DragEvent.END]

  B[工具指针 effect] --> B1[brush 绘制]
  B --> B2[eraser 删除]
  B --> B3[select 模式放行给 Leafer Editor]

  C[舞台尺寸 effect] --> C1[首次创建 stage / board]
  C --> C2[viewSize 变化时 set scale 和居中偏移]
  C --> C3[viewport 变化时 set board 尺寸]

  D[节点增量同步 effect] --> D1[新增缺失 UI]
  D --> D2[删除 stale UI]
  D --> D3[已有 UI 只 set 属性]
  D --> D4[父级或顺序变化时移动 UI]

  E[选区同步 effect] --> E1[selectedIds -> uiMap]
  E --> E2[调用 editor.select 或 cancel]
```

## 为什么之前会重建画布

旧实现里的“重建画布”不是重建 React 页面，而是：当画布内容数据变化时，把 Leafer 里的旧 `stage` 销毁，然后用最新 `nodeMap/rootIds` 重新创建 Leafer UI。

重建的原因是 Leafer 是命令式场景树：

```mermaid
flowchart TD
  StoreChange[store 中节点数据变化] --> NeedSync[Leafer 场景树需要同步]
  NeedSync --> DestroyOld[销毁旧 stage]
  DestroyOld --> CreateStage[创建新 stage]
  CreateStage --> CreateBoard[创建 board]
  CreateBoard --> CreateNodes[按 rootIds 创建节点 UI]
  CreateNodes --> Map[写入 uiMap: nodeId -> Leafer UI]
```

这个做法简单，但代价较大。拖拽一个节点、编辑一段文字、切换图层顺序，都会把整个 `stage -> board -> nodes` 重建一遍。后续如果加入图片、视频、音频，这种全量重建会导致媒体实例重新加载或播放状态丢失。

## 当前的增量同步

当前实现已经改成增量同步：

```mermaid
flowchart TD
  StoreChange[store 中节点数据变化] --> Sync[节点增量同步 effect]
  Sync --> Missing[uiMap 缺失的 nodeId]
  Missing --> Create[创建单个 Leafer UI 并绑定事件]
  Sync --> Removed[uiMap 中不再可达的 nodeId]
  Removed --> Destroy[销毁单个 stale UI]
  Sync --> Existing[已有 UI]
  Existing --> Set[ui.set 最新位置/尺寸/文本/样式]
  Sync --> Order[parent.children 顺序不一致]
  Order --> Move[parent.remove + parent.add 到目标 index]
```

现在各类变化的处理方式是：

- 新增节点：只创建新增节点对应的 UI。
- 删除节点：只销毁被删除节点对应的 UI。
- 拖拽或编辑后的位置、尺寸、文本变化：只对已有 UI 调 `set()`。
- `rootIds` 或 `childrenIds` 顺序变化：只移动对应父容器里的 UI 顺序。
- group 父级变化：只把 UI 从旧父容器移动到新父容器。
- `viewport` 或 `viewSize` 变化：只更新 `stage` 的 `scale/x/y` 和 `board` 的尺寸，不重建节点。

只有一种情况会销毁并重建单个 UI：同一个 nodeId 的 `kind` 发生变化。比如未来把一个节点从 `rect` 变成 `image`，对应 Leafer 类不同，就需要替换这个节点自己的 UI。

不触发节点同步的情况：

- 单纯选中或取消选中，只同步 Editor 选择框。
- 工具从 `select` 切到 `brush` 或 `eraser`，只影响交互模式。

选中态走单独的选区同步 effect。

## 工具光标逻辑

工具模式分两层处理：

```mermaid
flowchart TD
  Toolbar[CanvasToolbar] --> Mode[activeTool]
  Toolbar --> BrushSize[brushSize]
  Toolbar --> EraserSize[eraserSize]
  Mode --> HomeStyle[Home 设置 DOM cursor]
  EraserSize --> HomeStyle
  Mode --> HookTool[useLeaferCanvas tool 参数]
  BrushSize --> HookTool
  EraserSize --> HookTool
  HookTool --> Pointer[Leafer pointer 事件]
```

`activeTool / brushSize / eraserSize` 都保存在 `Home` 组件里：

- `activeTool` 决定当前是选择、画笔还是橡皮擦。
- `brushSize` 传给 `useLeaferCanvas`，用于创建画笔线条的 `strokeWidth`。
- `eraserSize` 同时传给 `useLeaferCanvas` 和 DOM cursor。前者决定真实擦除路径的宽度，后者决定鼠标图标的视觉大小。

橡皮擦 cursor 不是一个固定尺寸的图片文件，而是在 `Home` 里用 `createEraserCursor(eraserSize)` 动态生成 SVG data URI：

```mermaid
flowchart LR
  EraserSize[eraserSize] --> Clamp[限制到 12-64]
  Clamp --> Svg[生成同尺寸 SVG]
  Svg --> Hotspot[按比例计算热点]
  Hotspot --> CursorStyle[style.cursor]
```

这样做的原因是：如果直接使用用户给的 `width=200 height=200` SVG，浏览器会把鼠标图标渲染得很大，和真实橡皮擦粗细不一致。现在 cursor 的视觉大小跟随工具栏里的橡皮擦粗细，例如：

- 选择 `24px` 时，cursor SVG 是 `24 x 24`。
- 选择 `64px` 时，cursor SVG 是 `64 x 64`。
- 热点也按比例放在橡皮擦左下角附近，避免鼠标实际擦除点和图标位置明显错位。

这部分只影响鼠标显示，不参与节点同步，也不会导致 Leafer UI 重建。

## 选中逻辑

选中有两个方向的数据流。

### 用户操作到 store

```mermaid
sequenceDiagram
  participant User as 用户
  participant Leafer as Leafer Editor
  participant Hook as useLeaferCanvas
  participant Store as canvasStore

  User->>Leafer: 点击或框选
  Leafer->>Hook: EditorEvent.SELECT
  Hook->>Hook: UI 对象映射为 nodeId
  Hook->>Store: selectNodes(ids)
  Store->>Store: 更新 selectedIds / activeId
```

Leafer 的 `EditorEvent.SELECT` 给的是 UI 对象，不是业务 id。hook 用 `uiMapRef` 反查：

```text
Leafer UI -> nodeId -> selectNodes(ids)
```

### store 到 Leafer Editor

```mermaid
sequenceDiagram
  participant Store as canvasStore
  participant Hook as useLeaferCanvas
  participant Leafer as Leafer Editor

  Store->>Hook: selectedIds 变化
  Hook->>Hook: selectedIds 映射为 selectedUIs
  Hook->>Leafer: editor.select(selectedUIs)
  Leafer->>Leafer: 显示选择框和控制点
```

这一段只是同步选择框，不应该改节点数据，也不应该重建场景。

## 之前为什么会出问题

之前场景重建时用了：

```ts
app.tree.clear();
```

问题是 `app.tree` 里不只有我们的节点，也可能有 Leafer Editor 自己的选择层、编辑框、控制点等内部对象。

错误链路大致是：

```mermaid
flowchart TD
  Rebuild[节点变化后重建场景] --> ClearTree[app.tree.clear]
  ClearTree --> EditorLost[Editor 内部选择层被清掉]
  EditorLost --> OldRef[Editor 仍持有旧 UI 或旧选择层引用]
  OldRef --> SyncSelect[selectedIds 再同步 editor.select]
  SyncSelect --> Warning[Branch add self or destroyed]
  Warning --> Broken[元素消失、框选失效、选择状态异常]
```

所以修复后不再清空整个 `app.tree`。第一次创建时把 `stage` 加进去，之后只维护自己的 `stageRef` 和 `boardRef`：

```mermaid
flowchart TD
  First[首次初始化] --> Create[创建 stage / board]
  Create --> Add[app.tree.add(stage)]
  Resize[viewSize / viewport 变化] --> StageSet[stage.set scale/x/y]
  Resize --> BoardSet[board.set width/height]
  Editor[Leafer Editor 内部层] --> Keep[保留不动]
```

这能避免破坏 Leafer Editor 的内部结构。

## 当前同步保护

还有一个细节：代码主动调用 `editor.select()` 时，Leafer 也可能同步触发 `EditorEvent.SELECT`。

如果不保护，就会形成回环：

```mermaid
flowchart TD
  StoreSelected[selectedIds 变化] --> HookSelect[hook 调 editor.select]
  HookSelect --> EditorEvent[Leafer 触发 EditorEvent.SELECT]
  EditorEvent --> StoreAgain[再次 selectNodes]
  StoreAgain --> HookSelect
```

所以现在用 `isSyncingEditorSelectionRef` 标记“这是程序同步，不是用户操作”。这类事件会被忽略，只处理用户真实点击或框选触发的选择事件。

同时，调用 `editor.select()` 前会比较当前 Editor 选区和目标选区是否一致。一致就不重复调用，减少 Leafer 内部状态抖动。

## 一句话总结

`useLeaferCanvas` 的原则是：

- `stage/board` 初始化一次，尺寸变化只更新缩放和尺寸。
- `nodeMap/rootIds` 变化时，对节点 UI 做增量增删改和排序。
- `selectedIds` 变化时，只同步 Leafer Editor 的选择框。
- 不清空整个 `app.tree`，避免破坏 Leafer Editor 内部层。
- 程序化 `editor.select()` 触发的选择事件不再反写 store，避免循环。
