# leafer-x-curved-text

Leafer 2.2.3 弧形富文本对象。`CurvedText` 是可加入 Leafer 场景的 `Group`，内部按 Unicode 字素簇创建独立 `Text` 子对象。Group 可以像普通画布对象一样整体选择、移动、旋转和缩放；开启 `characterEditing` 后可点击单字或拖动选择连续字素范围。

## 使用

```ts
import { CurvedText } from "leafer-x-curved-text";

const curvedText = new CurvedText({
  x: 240,
  y: 180,
  text: "你好，curved text",
  layout: {
    bendAngle: 120,
    direction: "clockwise",
    radius: 220,
    startAngle: -90,
    align: "center",
    letterSpacing: 1,
  },
  defaultStyle: { fontFamily: "Arial", fontSize: 32, fill: "#172554" },
  styleRuns: [{ start: 0, end: 2, style: { fontSize: 40, fill: "#d9465f" } }],
  characterEditing: true,
});

app.tree.add(curvedText);
curvedText.on("character-selection-change", ({ start, end }) => {
  // start / end 按字素簇索引，使用 [start, end) 半开范围。
});
```

`layout` 支持 `bendAngle`（0 到 360 度）、`direction`、`radius`、`startAngle`、`align`、`letterSpacing` 和 `locale`。角度为 0 时恢复水平直线排版。正角度结合 `clockwise` / `counterclockwise` 决定弧线方向和字形切线旋转。

实例方法：

- `setText(text)` 更新文本并重新布局。
- `setLayout(partialLayout)` 更新布局参数并重新布局。
- `setStyles(defaultStyle, styleRuns)` 更新默认样式和范围覆盖。
- `setCharacterSelection({ start, end })` 设置字素范围选区。
- `clearCharacterSelection()` 清除选区。
- `toJSON()` 返回 `CurvedTextData` 持久化数据；不要序列化插件实例本身。
- `destroy()` 清理子 UI 和监听器。

样式区间使用字素簇索引与 `[start, end)` 语义。可设置 Leafer Text 支持的字体、字号、字重、颜色（`fill`）、描边（`stroke` / `strokeWidth`）和阴影（`shadow`）。

## 字体与测量

宿主负责加载、注册自定义字体，并在字体 ready 后创建对象或调用 `setStyles` / `setLayout` 触发重排。插件不会加载或持有字体资源。默认测量器使用 Canvas 2D `measureText`；也可通过 `measureGrapheme` 注入同步测量函数，便于无 DOM 环境、worker 或宿主自定义度量。

排版把每个字素簇独立测量后按 advance 比例放到圆弧上。因此逐字素 Text 的 kerning、连字、复杂脚本 shaping、双向文字和 emoji 字体度量可能与整段 Text 不同；这不是整段文本轮廓变形。当前不支持多行、闭合路径、任意贝塞尔路径或非连续多段选区。

选区是运行时交互状态，不写入 `toJSON()`；宿主可从 `character-selection-change` 事件读取范围并管理字符工具栏与样式编辑。字体测量回调也不会进入序列化数据。`toJSON()` 输出的 `kind: "curvedText"`、文本、布局、默认样式和样式区间可由宿主纳入自己的文档模型、历史和缩略图绘制逻辑。

## Demo 与开发

`main.ts` 是纯 HTML Demo 入口，可通过 `pnpm --filter leafer-x-curved-text dev` 运行。

```bash
pnpm --filter leafer-x-curved-text test:run
pnpm --filter leafer-x-curved-text build
```
