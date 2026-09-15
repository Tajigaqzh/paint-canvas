# leafer-x-magnifier

Leafer 放大镜插件：指针悬停在画布上时，用一个镜片局部放大画布。

镜片直接对 Leafer 已经渲染出来的画布做 `drawImage` 放大，不复制场景树，所以笔迹、图片、
动画当前帧都会被一起放大，也不需要为了放大重建任何节点。

## 特点

- **不依赖任何框架。** `src/` 里没有任何 React / Vue / 状态库，只用到 `@leafer-ui/interface` 的类型，
  运行时不 import Leafer。状态由宿主自己管：React store、Vue `reactive`、一个普通变量都可以。
- **零侵入。** 镜片是插件自己创建、挂在宿主容器里的 DOM canvas，不进入 Leafer 场景树，
  不影响宿主的节点增删改和增量同步。
- **懒创建。** 构造插件不碰 DOM，第一次指针悬停才创建镜片，方便在没有 `document` 的阶段先建实例。

## 安装

```bash
pnpm add leafer-x-magnifier
```

需要宿主自己提供 Leafer（`@leafer-ui/core` 或 `leafer-ui`）。

## 使用：纯 HTML / 无框架

```ts
import { App, Rect } from "leafer-ui";
import { Magnifier } from "leafer-x-magnifier";

const app = new App({ view: window, fill: "#eef1f6" });

app.tree.add(new Rect({ x: 120, y: 120, width: 260, height: 160, fill: "#1AA5FF" }));

const magnifier = new Magnifier(app, { size: 200, zoom: 3 });

// 状态放哪由你决定，这里就是一个普通变量。
magnifier.enabled = false;
```

镜片默认挂在 Leafer 画布的父元素里，并自动给该容器补上 `position: relative`。
想放到别处就传 `container`：

```ts
new Magnifier(app, { container: document.querySelector(".workspace") });
```

## 在 React / Vue 里用

插件只管交互和绘制，框架适配层由宿主自己写，两边都只有十行左右。

React：

```tsx
useEffect(() => {
  const magnifier = new Magnifier(app, { container, enabled: false });

  magnifierRef.current = magnifier;

  return () => magnifier.dispose();
}, [app]);

useEffect(() => {
  magnifierRef.current?.set({ enabled: tool === "magnifier", size, zoom });
}, [tool, size, zoom]);
```

Vue：

```ts
const magnifier = shallowRef<Magnifier | null>(null);

onMounted(() => {
  magnifier.value = new Magnifier(app, { container: shell.value! });
});
onUnmounted(() => magnifier.value?.dispose());

watch([tool, size, zoom], ([mode, s, z]) => {
  magnifier.value?.set({ enabled: mode === "magnifier", size: s, zoom: z });
});
```

## 配置

| 配置项      | 说明                                                 | 默认值              |
| ----------- | ---------------------------------------------------- | ------------------- |
| `enabled`   | 是否启用；禁用时不响应指针并收起镜片                 | `true`              |
| `size`      | 镜片直径（CSS 像素）                                 | `200`               |
| `zoom`      | 相对当前屏幕显示的放大倍数，`1` 表示和画布显示一样大 | `3`                 |
| `container` | 镜片的定位容器                                       | Leafer 画布的父元素 |
| `view`      | 监听指针的元素                                       | Leafer 画布的父元素 |
| `className` | 镜片元素的 class，方便用样式表追加外观               | 无                  |
| `style`     | 覆盖镜片默认外观（行内样式，优先级高于样式表）       | 无                  |

## 内置属性与方法

| 成员          | 说明                                                  |
| ------------- | ----------------------------------------------------- |
| `enabled`     | 启用 / 禁用（get / set）                              |
| `size`        | 镜片直径，改动后立即按上一次指针位置重绘（get / set） |
| `zoom`        | 放大倍数，改动后立即重绘（get / set）                 |
| `set(config)` | 批量更新配置，只处理传入的字段                        |
| `render()`    | 按当前指针位置强制重绘                                |
| `hide()`      | 收起镜片                                              |
| `dispose()`   | 解绑指针监听并移除镜片                                |

同时导出两个纯函数，方便宿主做自定义镜片或单测：

- `getMagnifierSample(offset, size, zoom, pixelRatio)`：按倍率反推取样区域。
- `drawMagnifierLens(lens, source, size, sample, pixelRatio)`：先铺白底再 `drawImage` 放大。

## 开发与发布

```bash
pnpm test      # Vitest（jsdom）
pnpm demo      # 纯 HTML Demo，见 main.ts
pnpm build     # dist/（esm + cjs）+ types/（d.ts）
```

工作区里宿主直接消费 `src/`（`package.json` 的 `exports` 指向源码，开发时无需先构建）；
`publishConfig` 会在发布时把入口切到 `dist` 与 `types`。

`src/` 只允许引用 `@leafer-ui/core`、`@leafer-ui/interface`，并且它们被标记为
`external`，不会被打进产物（当前产物 gzip 约 1.6 kB，里面没有任何 Leafer 代码）。

## License

MIT
