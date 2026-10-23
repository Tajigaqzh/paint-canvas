# leafer-x-curved-text

Leafer 曲线文字插件的纯算法原型：提供 Unicode 字素簇切分、可注入字符测量接口和圆弧布局。当前包尚未包含 Leafer 场景对象、字符命中或编辑 UI。

## Unicode 与 emoji

`splitGraphemes` 使用 `Intl.Segmenter` 按 grapheme cluster 切分，组合 emoji 会作为一个字符单元处理，包括肤色修饰符、ZWJ 家庭/职业序列、区域旗帜、变体选择符和键帽 emoji。运行环境不支持 `Intl.Segmenter` 时使用内部回退分割器。

## 字符测量与自定义字体

`layoutArcText` 不直接访问 DOM 或 Canvas；调用方注入 `GraphemeMeasurer`。测量请求带有字素簇及合并后的字符样式，包括 `fontFamily`、`fontSize`、`fontWeight` 和 `fontStyle`。宿主可用 Canvas 2D 或其他测量器实现该接口。

自定义字体由宿主负责加载和注册，并确保测量前字体已 ready；插件不会下载或持有字体资源。浏览器宿主可在 `document.fonts.load()` 完成后再调用布局，避免按 fallback 字体测量导致位置变化。字体授权与作品导出嵌入策略由宿主产品负责。

## API

```ts
import { layoutArcText, splitGraphemes } from "leafer-x-curved-text";

const glyphs = splitGraphemes("Hi 👩🏽‍🚀!");
const layout = layoutArcText(
  "数学 👨‍👩‍👧‍👦",
  {
    bendAngle: 120,
    direction: "clockwise",
    radius: 240,
    defaultStyle: { fontFamily: "Teacher Sans", fontSize: 32 },
  },
  ({ grapheme, style }) => measureWithCanvas(grapheme, style),
);
```

字素簇索引可用于字符范围样式和选择。返回的 `x` / `y` 是局部布局坐标，`rotation` / `angle` 使用度。

## 开发

```bash
pnpm --filter leafer-x-curved-text test:run
pnpm --filter leafer-x-curved-text build
```
