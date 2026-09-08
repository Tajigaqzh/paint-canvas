# AGENTS.md

面向在本仓库改代码的编码助手。产品能力、目录树、后续规划以根目录 `README.md` 为准；这里只写**改代码时必须遵守的约定**，避免踩坑。

## 项目是什么

`paint-canvas` 是画布制作工具：React 19 + TypeScript + Vite 8 + Ant Design 6 + LeaferJS 2 + Zustand。制作页用固定 **1920×1080** 业务坐标管理多页面文档，Leafer 只负责渲染和交互，`canvasStore` 才是唯一数据源。

包管理用 **pnpm**。Leafer 相关包钉在 **2.2.3**（`pnpm.overrides` 里的 `@leafer-ui/interface`、`@leafer/interface`），不要随便升版本。

## 常用命令

```bash
pnpm install
pnpm dev          # 开发，默认端口 5174
pnpm build        # tsc -b && vite build
pnpm lint         # oxlint
pnpm format       # oxfmt 格式化 src
pnpm test:run     # Vitest 单次
pnpm e2e          # Playwright
```

改完类型或 worker 后至少跑 `pnpm exec tsc -b`。不要用 npm / yarn。不要改 git config，未经用户明确要求不要 commit / push。

## Git 钩子

- `commit-msg`：Conventional Commits，`type: 摘要`（如 `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`）。中文摘要可以；标题不超过 120 字。
- `pre-push`：先 `pnpm format`（oxfmt 格式化 `src`），再 `pnpm test:run`；任一失败则禁止 push。
- 安装依赖会跑 `prepare` → `husky`。不要用 `--no-verify` 跳过，除非用户明确要求。

## 架构红线

1. **Store 是真源，Leafer 是渲染缓存。** 节点增删改、选区、历史都走 `src/stores/canvasStore.ts`。不要把业务状态只写在 Leafer UI 上。
2. **增量同步，禁止 `app.tree.clear()`。** 会打掉 Editor 内部选择层。按 `nodeId` 增删改 UI。
3. **坐标系。** `board` 固定 1920×1080；`stage` 只做缩放和居中。业务数据不要改成跟 DOM 像素绑定。
4. **选区。** 用户操作由 Leafer Editor 写回 `selectedIds`；程序化 `editor.select()` 必须带同步标记，避免回写死循环。窗口尺寸变化后要刷新 Editor 选区。
5. **历史。** 用 `mutative` patches，不要整页快照。拖拽类高频操作注意历史条数上限。
6. **动画。** 用 `@leafer-in/animate` 写到 Leafer `animation`。创建节点时带上；之后增量 `set` 不要每次重写 `animation`，否则拖拽会打断播放。多条动画顺序见 `PropertyPanel/animationOrder.ts`。

## 改代码落点

| 要改什么 | 优先改哪里 |
|---|---|
| 节点类型 / 字段 | `src/types/elementNode`，然后 `leaferCanvas/ui`、属性面板、`worker/page-thumbnail/render` |
| 图片加载 | 只走 `src/worker/image-cache`；Leafer 侧 `ui/imageUi.ts` |
| 命中检测 | `leaferCanvas/geometry/hitDetection.ts` |
| 舞台缩放 / 指针坐标 | `leaferCanvas/geometry/boardLayout.ts`（`useStageBoard` 与 `usePointerTools` 共用） |
| 画笔 / 橡皮 | `leaferCanvas/tools/`（`brush.ts` / `eraser.ts`），由 `usePointerTools` 组合 |
| 共享 refs | `leaferCanvas/core/useRuntime.ts` |
| App 生命周期、原生事件 | `leaferCanvas/core/useLeaferApp.ts` |
| Leafer 运行时类型 | `src/types/leafer`，不要在 hook 下再建 `shared` |
| 画布 hook 拆分 | 同步 `src/pages/home/hooks/README.md`、根 `README.md` 和 `docs/useLeaferCanvas-logic.md` |

制作页入口只调 `useLeaferCanvas`，不要把 Leafer 细节散进 `Home`。

`kind` 写在**各个节点接口上**，不要放到 `CanvasNodeBase` 上，否则联合类型判别会坏掉（`TS2367`）。

## 图片与 Worker

- **只有** `image-cache` Dedicated Worker 对远程图片 URL 发 `fetch`。主线程、缩略图 worker、其它 worker 都不要自己 `fetch` 图片。
- 主画布：`getImageBlob` → `URL.createObjectURL` → Leafer `Image.url`。销毁节点前必须先断开 url 再 `revokeObjectURL`，再 `ui.destroy()`。App 卸载时清掉全部 object URL。
- 缩略图：主线程 `MessageChannel` 转交 port；缩略图 worker **不能** `new Worker` 图片线程（Dedicated Worker 一对一）。
- 缩略图包不要引用 `@/worker/image-cache` 桶文件（会把 `new Worker(imageCache.worker)` 打进去），只引 `client.ts` / `types.ts`。
- 素材面板 `<img>` **不走** 这套缓存，只负责把 URL 写入节点。
- 制作页默认 **不注册** Service Worker。`registerImageCacheServiceWorker` 和 `public/image-cache-sw.js` 只给实验页。
- L3 `fetch` 默认 CORS、`credentials: omit`；需要改请求头或 cache 时走 `getImageBlob(url, fetchInit)`。
- 详细设计：`src/worker/README.md`、`src/worker/image-cache/README.md`。

橡皮擦目前只作用在 `line`（`eraserPaths`），不要误改成删整颗矩形 / 文本节点。

## 代码风格

- TypeScript：`verbatimModuleSyntax`，类型用 `import type`。路径别名 `@/`。
- 导出跟现有文件一致：具名导出为主，组件可以用函数声明。
- 注释用**中文**，写清「为什么」；不要给显而易见的赋值逐行翻译。
- 优先可读：懒初始化用显式 `if (!x) x = ...`，不要为了新语法牺牲清晰度。
- 改动保持最小：不顺手大重构、不删无关注释、不主动加文档除非任务需要。
- UI 改完：有浏览器工具就走一遍真实操作；没有就跑相关测试，并说明未做浏览器验证。
- 样式：制作页已有 `index.less` + 少量 Tailwind；优先跟周围文件，不要混进一套新的 CSS 方案。

## 测试与实验页

### 范围与文件

- 单测框架：Vitest + jsdom，全局 setup 在 `src/test/setup.ts`（jest-dom、`matchMedia`、`ResizeObserver`、`Worker` mock）。
- 单测放在**源码所在目录的 `__test__/`** 下，文件名与实现文件同名，后缀用 `.test` 或 `.spec`（二选一即可）：`hitDetection.ts` → `__test__/hitDetection.test.ts` 或 `__test__/hitDetection.spec.ts`，页面 `index.tsx` → `__test__/index.test.tsx`。不要把测试文件和实现文件平铺在同一层。
- **每个页面文件、每个 `.ts` / `.tsx` 实现文件都必须有对应单测。** 纯类型文件（只 `export type` / `interface`、无运行时代码）除外。
- 改已有函数时同步补用例；新增文件时测试和实现一起交。相关改动完成后跑 `pnpm test:run`。
- e2e（`tests/e2e`）只覆盖跨面板的整页流程，**不能代替** 方法级单测。
- `src/pages/image-cache-test/` 和图片缓存测试服务不是制作页主流程，不要把实验逻辑耦进 `home`。

### 粒度与用例拆分

- **粒度到方法 / 函数。** 每个导出函数、以及模块内被页面或其它模块调用的方法都要单独测，不要只写一个「整个文件能跑」的冒烟用例。
- **一种传参组合一条用例。** 正常值、缺省值、空值、`0` / 空字符串 / 空数组、越界、非法 URL、失败 Promise、Worker / fetch 异常等，正常边界和异常边界都要覆盖，不要把多种输入塞进同一个 `it`。
- 用例名写清输入和期望（中文即可），例如 `空 url 应抛「图片地址不能为空」`，不要写 `works` / `test1`。
- 结构用 Arrange → Act → Assert；一条用例只断言一件行为。能同步测的不要写成 `async`。

### 断言与隔离

- 断言可观察结果：返回值、抛错信息、store 状态、DOM 文本/角色、对协作模块的调用参数。不要断言无关实现细节（内部临时变量、CSS class 拼写、mock 被调用了几次但业务不关心次数）。
- 测行为，不测「写了多少行代码」。不要为了覆盖率去测 TypeScript 类型或纯常量对象。
- 用例彼此独立：不依赖执行顺序；`beforeEach` / `afterEach` 恢复 store、定时器、`vi.restoreAllMocks()`、`URL.revokeObjectURL`、worker `terminate`。
- 禁止单测打真实网络。`fetch`、IndexedDB、`Worker`、Leafer、`createImageBitmap` 一律 mock 或注入假实现。
- 只 mock **边界**（Leafer、Worker、IDB、fetch），不要 mock 正在测的那个模块。需要测 `resolveImageBlob` 时，mock 的是 `fetch` / IDB，而不是 `resolveImageBlob` 自己。
- 组件交互用 Testing Library（按角色、文案查询），优先 `userEvent`，少用直接改 state。
- 时间相关（动画 duration、防抖）用 `vi.useFakeTimers()`，测完 `useRealTimers()`。
- 快照（`toMatchSnapshot`）只给稳定、无随机 id 的纯展示；画布节点、nanoid、日期不要快照。
- 单测失败要稳定可复现；不要 `Math.random()`、真实时钟、真实端口。`nanoid` 在单测里 mock 成可控 id。

### 本仓库边界怎么测

- **Leafer**：沿用 `src/pages/home/__test__/index.test.tsx` 的 `vi.mock("leafer-ui")` 思路；测的是 store / 映射函数 / 命中检测，不是引擎像素。
- **canvasStore**：每个 action 一条路径；改节点后还要测对应 undo / redo patch。
- **image-cache**：`cache/resolveBlob`、LRU、IDB 封装可单测；协议层测 `get` / 错误回包。不要在单测里拉真 Dedicated Worker。
- **page-thumbnail/render**：把纯函数（圆角、折线、bounds）抽测；OffscreenCanvas 在 jsdom 里 mock。
- **imageUi**：测「换 src 会 revoke 旧 object URL」「destroy 前先清空 url」；`createObjectURL` 要 mock。


## 不要做的事

- 不要引入第二套画布引擎或再拉一套状态库。
- 不要把远程 `src` 直接塞给 Leafer Image（会绕开缓存且难回收）。
- 不要在缩略图里 `fetch` 或 `new Worker` 图片缓存线程。
- 不要把 Service Worker 重新接到制作页默认启动路径。
- 不要提交 `.env`、密钥、无请求的空 commit。
