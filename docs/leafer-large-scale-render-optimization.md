# LeaferJS 百万级元素渲染优化方案（插件化）

> 适用场景：制作页需要在同一画布上承载十万乃至百万级别的元素（散点、线条、图元、缩略块等），且要求平移 / 缩放 / 命中不卡顿。
> 目标：在不修改 Leafer 引擎的前提下，用 `leafer-x-*` 插件把「每帧真正参与渲染与命中检测的节点数」压到视口内的几千个。

---

## 1. 背景与卡顿根因

Leafer 2.2.3 默认是 **canvas2d + 每个元素一个 Leaf 节点** 的模型：

- 每帧渲染要遍历可见节点树并逐个绘制；
- 命中检测（指针 / 框选）默认是对节点做 O(n) 遍历；
- 节点增删改走对象树，百万节点本身也吃内存与初始化时间。

百万级元素在默认模型下必然卡，瓶颈**不在引擎性能，而在参与每帧计算 / 绘制的节点数量**。优化核心只有一个：**让视口外、且不在当前细节级别的元素，根本不进入「渲染 + 命中」这条路径**。

---

## 2. 设计约束（来自本仓库约定）

方案必须服从现有架构红线（见根 `AGENTS.md`）：

1. **Store 是真源，Leafer 是渲染缓存**：插件不持有业务状态，只负责把数据按视口画出来；数据增删改仍走 `canvasStore`。
2. **增量同步，禁止 `app.tree.clear()`**：批量增删合并到 `requestAnimationFrame`，只 `set` 变化节点，避免打掉 Editor 选择层。
3. **坐标系**：舞台等比缩放 / 居中挂在 `app.tree` 上，插件读 `app.tree.scale` / `app.tree.worldTransform` 反算指针与可见区域（与 `boardLayout` 同公式）。业务数据不绑 DOM 像素。
4. **插件包规范**：`leafer-x-*` 只 `import "@leafer-ui/core"` / `"@leafer-ui/interface"`，对外只给命令式 API（`enabled` / 设置项）+ 事件，状态由宿主管；自带头 `__tests__` 与 README，不引入 React / 状态库。
5. **图像填充桥接**：`IImagePaint.url` 接口类型是 `string`，运行时只认可 canvas / `<img>` / `ImageBitmap` 这类被栅格化的图像源，**不能直接吃 `<video>` 或 `VideoFrame`**。任何解码源（原生 `<video>`、WebCodecs、ffmpeg.wasm）落进 Leafer 的最后一脚都是「画到离屏 canvas → 当 `changeful` 图像填充」。这一点已在 `leafer-x-video-player` 验证，本方案复用同一条 canvas 桥接。

---

## 3. 优化方向总览（按收益排序）

| 方向 | 作用 | 收益 | 复杂度 |
| --- | --- | --- | --- |
| 视口裁剪 + 空间索引 | 只处理可见元素，命中 O(log n) | ★★★★★ 必做 | 中 |
| 自定义数据渲染层 | 不建真实节点，直接按视口绘制数据 | ★★★★★ 百万级主渲染 | 中高 |
| 静态层位图化缓存 | 不变内容烤成一张图，只渲染一次 | ★★★★ | 低 |
| LOD 细节分级 | 缩小画概览、放大画细节 | ★★★ | 低 |
| 增量同步 + 合帧 | 批量增删合并、只同步变化 | ★★★ 防止初始化/突发卡 | 低 |
| 分层隔离 | 动/静层分离，静态层只算一次 | ★★ | 低 |

---

## 4. 方向详述

### 4.1 视口裁剪 + 空间索引（必做）

- 插件订阅 `app.tree` 的变换（缩放 / 平移），用与 `boardLayout` 一致的公式算出**当前可见矩形**（world 坐标）。
- 维护一个**四叉树 / 均匀网格**索引，元素按包围盒插入。命中查询先查索引拿到候选集，再交给 Leafer 或插件自己做精确命中。
- 视口外元素：要么 `visible = false`（仍占树但跳过绘制），要么**根本不创建 Leaf 节点**（配合 4.3）。
- 这是百万级不卡的基石，和现有 ruler / snap「只读 `tree` 变换」的写法一致。

### 4.2 静态层位图化缓存

- 把**不变的大块内容**（如底图、已确定的成组图元）渲染一次到离屏 canvas，生成一张位图，用 `Image` 填充挂回。
- 之后平移 / 缩放只是整体变换这张图，子节点不再逐帧重画。
- 与 `leafer-x-video-player` 的 canvas 桥接思路相同，只是来源是静态快照。注意 `IImagePaint.url` 限制（见 §2.5），仍走 canvas 桥接。

### 4.3 自定义数据渲染层（核心推荐）

- **不建真实 Leaf 节点**：数据存在宿主的 `canvasStore`，插件用一个 Leafer `Canvas` / `Rect` 元素承载，在它的渲染钩子里直接拿 2D `context`，按当前视口把「可见的那批数据」画出来。
- 树中节点数恒定（≈视口分块数），与数据量 10 万 / 1000 万无关，这是百万级最稳的形态。
- 选区 / 拖拽：插件把指针坐标经空间索引（4.1）映射回数据索引，再反查 `canvasStore` 命中的业务节点，自己维护选择态，不依赖 Leafer 的逐节点命中。
- 代价：这些图元不是独立 Leaf 节点，无法享受 Leafer 内置的逐节点交互；交互要插件自己实现（但换来数量级性能提升）。

### 4.4 LOD 细节分级

- 缩放小于阈值：画包围盒 / 缩略位图 / 聚合点；放大到一定级别才画完整细节。
- 与裁剪配合，进一步砍掉无效绘制；适合地图 / 大数据散点类场景。

### 4.5 增量同步 + 合帧

- 数据批量变更（初始化、批量增删）合并进一个 `rAF` 回调，一次性 `set`；**禁止 `app.tree.clear()`**（会打掉 Editor 内部选择层）。
- 只同步增量，百万级初始化也分批灌入，避免长任务卡 UI。

### 4.6 分层隔离

- 动态层（正在编辑的少数元素）与静态层分离；静态层用隔离 / 缓存只算一次，只让动态层每帧重绘。

---

## 5. 推荐落地组合

```
百万级 = 自定义数据渲染层(4.3) 做主渲染
       + 视口裁剪 + 四叉树空间索引(4.1) 做取舍 / 命中
       + 静态层位图缓存(4.2) + LOD(4.4) 扛细节
       + 增量同步(4.5) 防突发卡顿
```

优先级：**4.1 与 4.3 一起做**是百万级的入场券；4.2 / 4.4 / 4.5 / 4.6 是进阶打磨。

---

## 6. 插件接口草案

> 以下为草案，具体 API 名待与 Leafer 2.2.3 实际接口核对；形态遵循现有 `leafer-x-*` 规范（构造配置 + 命令式方法 + 事件）。

### 6.1 空间索引 / 裁剪插件 `leafer-x-viewport-cull`

```ts
export type CullConfig = {
  /** 订阅变换的 tree（制作页即 app.tree）。 */
  tree: ILeaf;
  /** 命中查询的底层选择器（可选，默认用插件自带网格）。 */
  selector?: ISelector;
  /** 视口外预留边距（world 坐标），避免快速平移露白。 */
  margin?: number;
  enabled?: boolean;
};

export class ViewportCull extends Emitter<{
  /** 可见矩形变化（world 坐标），宿主据此决定加载/绘制哪批数据。 */
  viewport: { x: number; y: number; width: number; height: number };
}> {
  constructor(config: CullConfig);
  /** 插入一个数据包围盒，返回句柄用于后续删除/更新。 */
  insert(id: string, bounds: IBoundsData): void;
  remove(id: string): void;
  /** 给定 world 点，返回命中的候选 id 列表（已由索引收敛）。 */
  hit(point: IPointData): string[];
  /** 给定 world 矩形，返回矩形内的候选 id 列表。 */
  hitRect(rect: IBoundsData): string[];
  set(config: Partial<Omit<CullConfig, "tree">>): void;
  enabled: boolean;
  dispose(): void;
}
```

### 6.2 数据渲染层插件 `leafer-x-data-layer`

```ts
export type DataLayerConfig = {
  /** 承载绘制的 Leafer 元素（Canvas/Rect）。 */
  view: IUI;
  /** 取当前可见矩形的回调（一般接 ViewportCull 的 viewport 事件）。 */
  getViewport: () => IBoundsData;
  /** 设备像素比，用于放大离屏 canvas。 */
  dpr?: number;
  enabled?: boolean;
};

export type DrawItem = {
  id: string;
  /** 业务局部坐标下的包围盒。 */
  bounds: IBoundsData;
  /** 插件在此自绘，context 已按视口变换好。 */
  draw: (ctx: CanvasRenderingContext2D) => void;
};

export class DataLayer extends Emitter<Record<string, never>> {
  constructor(config: DataLayerConfig);
  /** 设置当前要绘制的数据集（宿主按视口裁剪后给入）。 */
  setItems(items: DrawItem[]): void;
  /** 触发一次重绘（数据变化但视口未变时调用）。 */
  requestRender(): void;
  enabled: boolean;
  dispose(): void;
}
```

> 说明：`DataLayer` 只负责「把可见数据画到 canvas 并当填充交给 Leafer」；「哪些数据可见」由宿主结合 `ViewportCull` 决定——两者解耦，渲染层不持有空间索引。

---

## 7. 关键实现要点

### 7.1 视口变换读取

复用 `boardLayout` 的同款公式：从 `app.tree.scale` 与 `app.tree.worldTransform` 反算指针 world 坐标与当前可见 world 矩形。`useRuler` / `useSnap` 已按此模式接线，插件照抄即可，不要另起一套坐标换算。

### 7.2 canvas 桥接（图像填充）

离屏 canvas 画完后作为 `changeful` 图像填充：

```ts
const fillPaint = { type: "image" as const, url: canvas as unknown as string, changeful: true };
view.set({ fill: fillPaint });
```

`changeful: true` 标记画布内容逐帧变化，保证 Leafer 重绘（与 `leafer-x-video-player` 一致）。

### 7.3 命中检测映射到数据索引

指针事件由插件在 `view` 上接收，转成 world 坐标 → `ViewportCull.hit(point)` 拿到候选 id → 反查 `canvasStore` 命中业务节点。这样百万数据也只需查索引，不遍历节点树。

---

## 8. 现实上限与风险

- canvas2d 每帧能画的简单图元有上限（视复杂度约几万到二十万量级）；靠「裁剪 + 位图缓存」把**每帧实际绘制**压到几千，即可稳 60fps。
- 再往上（单帧要画百万图元）需要 WebGL，但 Leafer 2.2.3 默认不是 WebGL 渲染后端，需另评估；本方案不依赖 WebGL。
- 自定义数据层下，图元不是独立 Leaf 节点：框选多选、吸附、动画等要插件或宿主自己实现（可用现成的 `leafer-x-easy-snap` 思路，但需桥接到数据索引）。
- 空间索引要和数据增删保持同步，否则命中结果失真——这是该方案主要的维护成本点。

---

## 9. 落地里程碑（建议顺序）

1. **M1 视口裁剪 + 四叉树**（`leafer-x-viewport-cull`）：先解决「百万节点进树导致卡」，用 `visible` 开关 + 索引收敛命中。改动小、风险低、收益直接。
2. **M2 自定义数据渲染层**（`leafer-x-data-layer`）：把高频海量图元改成「不建节点、直接画」，这是百万级的主渲染形态。
3. **M3 静态层位图缓存 + LOD**：把不变内容烤图、缩小时降细节，进一步压绘制。
4. **M4 增量同步合帧 + 分层隔离**：打磨初始化与突发批量场景。

---

## 10. 待确认 / 开放问题

- 百万级场景主要是哪类元素（散点 / 线 / 成组图元 / 缩略图块）？决定 `DataLayer` 的 `draw` 抽象粒度。
- 是否需要框选多选 / 吸附 / 逐节点动画？决定是否要为数据层补一套交互（复用 `leafer-x-easy-snap` 思路）。
- 制作页 `board` 固定 1920×1080，百万级元素是否意味着「可缩放的超大画布」场景？若仍是固定 board，需用分组 / 分块承载，方案不变但坐标细节需对齐 `boardLayout`。
- `leafer-x-data-layer` 的承载元素选 `Canvas` 还是 `Rect` + canvas 填充，待与 Leafer 2.2.3 接口核对后定。
