# leafer-x-richTextPlus 结构说明

本目录是 `ZhengNan-coder/leafer-x-richTextPlus` 的工作区接入版本。插件没有把每个字符创建成独立的 Leafer `Text` 节点，而是实现了一个自定义 `UI`，自己完成字符测量、布局、绘制、选区和编辑。这种方式可以在一个文本对象内保留连续文本、光标和字符级样式。

## 目录结构

```text
packages/leafer-x-richTextPlus/
├─ src/
│  ├─ RichTextPlus.ts       # 核心 UI：数据、布局、绘制、选区、输入、撤销重做
│  ├─ RichTextEditor.ts # Leafer Editor 的内部编辑器适配
│  ├─ RichTextData.ts   # Leafer 数据层适配，保留特殊单位值
│  ├─ EditingManager.ts # 全局编辑实例管理
│  ├─ types.ts          # IRichTextInputData、ICharStyle、IStyleRange 等类型
│  ├─ constants.ts      # 默认样式和文本分段规则
│  ├─ utils.ts           # 字素分割、字体测量、字重转换等工具
│  └─ index.ts           # 导出 API，并注册 RichTextEditor
├─ main.ts               # 本仓库的最小可运行 demo
├─ main.html             # demo 页面和样式操作按钮
└─ vite.config.ts        # demo 开发服务器，默认端口 5175
```

上游原始说明保存在 `UPSTREAM-README.md`，`upstream-main.ts` 是上游 demo 的参考副本；当前可运行 demo 使用的是根目录的 `main.ts`。

## 运行方式

```bash
pnpm --filter leafer-x-richTextPlus dev
```

浏览器打开 `http://localhost:5175/main.html`。双击文本进入编辑，拖动选择字符，再点击“选区变红”“选区放大”或“选区加粗”。

## 核心实现流程

### 1. `RichTextPlus` 是单个自定义 UI

`src/RichTextPlus.ts` 中的 `RichTextPlus` 继承 Leafer `UI`，通过装饰器声明文本、字号、填充、行高、换行和尺寸等响应式属性。构造时会：

1. 创建测量用 Canvas 2D context。
2. 从 `styleRanges` 或旧版 `styles` 导入字符样式。
3. 设置 `editInner = 'RichTextEditor'`，让 Leafer Editor 使用插件自己的内部编辑器。
4. 绑定指针和键盘相关事件。
5. 触发布局计算和首次渲染。

它不会把字符加入 `tree.children`。字符只存在于 `_graphemes`、`_lines` 和 `_styles` 等内部数据中，最终由 `__draw` 相关逻辑绘制到 Leafer 画布。

### 2. 字符按 Unicode 字素簇处理

`utils.ts` 的 `graphemeSplit()` 会把 emoji、ZWJ 家庭表情、肤色修饰符、组合字符等作为一个可编辑单位。光标和样式索引使用字素簇索引，而不是 JavaScript UTF-16 code unit 索引。

布局阶段会把文本分成行，再为每个字符计算：

- 字符实际样式和字体；
- advance width；
- 行内 x 坐标、基线和字号；
- 换行、段落间距、对齐和 padding。

因此同一行中不同字号的字符仍然可以共享正确基线，固定宽度时也能按真实字符宽度换行。

### 3. 单字符样式的存储方式

内部样式表 `_styles` 是两层 Map：

```ts
Map<lineIndex, Map<charIndex, ICharStyle>>
```

基础样式来自 `RichTextPlus.fontSize`、`RichTextPlus.fill` 等元素级属性；某个字符存在 `_styles[line][char]` 时，该字符样式覆盖基础样式。

初始的 range 数据由 `_loadFromStyleRanges()` 展开为逐字符记录（`RichTextPlus.ts:3475` 附近）：

```ts
for (let i = start; i < end; i += 1) {
  const loc = this._linearToLocation(i)
  this._styles.get(loc.lineIndex)!.set(loc.charIndex, { ...style })
}
```

这样导入格式简洁，运行时查找又可以精确到单个字素。

## 选区样式是如何生效的

编辑状态下，实例维护两个线性字素索引：`selectionStart` 和 `selectionEnd`。调用：

```ts
richText.setSelectionStyles({ fill: '#dc2626', fontSize: 58 })
```

核心逻辑在 `RichTextPlus.ts:1184` 附近：

1. 如果没有选区，直接返回。
2. 记录撤销快照。
3. 遍历 `[selectionStart, selectionEnd)` 的每个字素。
4. 用 `_linearToLocation()` 把线性索引转换为行索引和行内字符索引。
5. 将新样式与该字符已有样式合并，而不是覆盖全部样式：

```ts
const existing = lineStyles.get(charIndex) || {}
lineStyles.set(charIndex, { ...existing, ...style })
```

6. 调用 `_relayout()`，重新测量并重绘。

所以“只改颜色”不会丢失该字符原有的字号、字体或阴影；字号变化也会触发行高和包围盒重新计算。

## 编辑器接入

`RichTextEditor.ts` 使用 `@registerInnerEditor()` 注册内部编辑器。双击文本后，Leafer Editor 调用 `onLoad()`：

- 调用 `richtext.enterEditing()`；
- 暂停 Editor 的通用快捷键，避免和文本编辑快捷键冲突；
- 将画布的 pointer down/move/up 转发给 `RichTextPlus`；
- 退出时在 `onUnload()` 恢复 Editor 配置并清理监听。

`RichTextPlus` 内部使用隐藏 `textarea` 接收输入法、复制粘贴和键盘事件，再把 textarea 的 UTF-16 selection 转换回字素索引。`EditingManager` 保证同时只有一个 RichTextPlus 处于编辑状态，新的实例进入编辑时会先让旧实例退出。

## 序列化与反序列化

对外推荐使用 Figma 风格的 `styleRanges`：

```ts
[
  { start: 0, end: 2, fill: '#d9465f', fontWeight: 'bold' },
  { start: 8, end: 10, fontSize: 54 }
]
```

运行时样式是逐字符 Map，导出时 `_compressToStyleRanges()` 会把相邻且样式相同的字符重新合并为 range，减少 JSON 体积。旧版 `styles` 格式仍可读写，用于兼容按行/字符索引的历史数据。

## 与当前项目的边界

制作页的普通 `TextNode` 已接入 RichTextPlus，并持久化 `styleRanges` 与路径字段。插件只通过回调上报选区和路径编辑结果，最终数据仍由宿主 `canvasStore` 管理。

## 路径文字

`RichTextPlus` 支持直线、圆形和自定义三次贝塞尔路径：

```ts
const text = new RichTextPlus({
  text: '沿路径排版',
  textPath: 'circle',
  pathRadius: 140,
  pathStartAngle: -90,
  pathDirection: 'forward',
  pathSide: 'outer',
  pathAlign: 'center',
})
```

`pathSide: 'outer'` 让字身朝圆弧外侧展开，`inner` 让字身朝圆心展开。`pathDirection` 只控制阅读方向，不会隐式改变内外侧。

自定义路径使用 `pathAnchors`：

```ts
text.setPathAnchors([
  { x: -180, y: 0, handleOut: { x: 90, y: -120 } },
  { x: 0, y: -90, handleIn: { x: -70, y: -40 }, handleOut: { x: 70, y: 40 } },
  { x: 180, y: 0, handleIn: { x: -90, y: -120 } },
])
text.setPathEditing(true)
```

路径编辑状态会绘制轨迹、锚点和控制柄。拖动结束后触发一次 `onPathChange`，宿主应把返回的路径数据写回自己的数据源。`convertCircleToPath()` 可将圆形转换为四段贝塞尔路径，再继续增加、删除或移动锚点。

字符级旋转直接扩展在 `IStyleRange` 上：

```ts
styleRanges: [{ start: 2, end: 3, rotation: 15 }]
```

路径文字中该角度叠加在自动切线角度上；普通文字中则围绕字符中心旋转。

