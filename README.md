# Paint Canvas

一个基于 React、TypeScript、Vite、Ant Design 和 LeaferJS 的画布制作工具。项目目标是提供一个可视化制作页，支持多页面画布、基础图形编辑、自由绘制、缩略图预览、动画配置，以及后续的图片缓存、导入导出和 AI 绘制能力。

## 当前能力

- 多页面画布：底部缩略图展示页面，支持新增页面和切换页面。
- 画布编辑：基于 LeaferJS 渲染主画布，支持选择、拖拽、缩放、旋转和多选。
- 基础图形：支持矩形、圆形、椭圆、圆环、扇形、扇形圆环、圆角弧线、线条、三角形、正多边形、星形和文本。
- 自由绘制：顶部工具栏支持选择、画笔、橡皮擦；画笔和橡皮擦都支持粗细选择。
- 右键菜单：支持打组、拆组、调整层级和删除选中元素。
- 属性面板：支持位置、尺寸、旋转基准、填充、描边颜色、描边粗细、线型、图形专属参数和元素动画配置。
- 缩略图渲染：通过 `OffscreenCanvas` 在 worker 中绘制页面缩略图，只展示白色画布和画布内元素。
- 撤销重做：基于 Immer patches 记录画布操作历史。
- 图片缓存实验：包含图片请求缓存和 Service Worker 相关实验代码。

## 技术栈

- React 19
- TypeScript
- Vite
- Ant Design
- LeaferJS
- Zustand
- Immer
- Oxlint
- Vitest / Playwright

## 本地运行

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm build
pnpm lint
pnpm test
pnpm test:run
pnpm e2e
pnpm image-cache:test-server
```

## 目录结构

```text
src/
  pages/
    home/
      components/
        CanvasContextMenu/       右键菜单
        CanvasToolbar/           顶部工具栏
        MaterialPanel/           左侧素材面板
        PageThumbnailStrip/      底部缩略图列表
        PropertyPanel/           右侧属性面板
          nodeProperty/          各类节点的专属属性配置
      hooks/
        useLeaferCanvas.ts       主画布 Leafer 渲染和交互
      index.tsx                  制作页入口
      index.less                 制作页样式
  stores/
    canvasStore.ts               多页面画布状态、历史、节点操作
  types/
    canvas/                      画布、页面、store 类型
    edit/                        编辑器类型
    elementNode/                 节点类型
  worker/
    thumbnail/                   缩略图 worker 渲染
public/
  image-cache-sw.js              图片缓存 Service Worker 实验
scripts/
  image-cache-test-server.mjs    图片缓存测试服务
```

## 后续计划

来自 `.agents/todo.md` 的制作页规划：

- 元素隐藏与展示
- 图片与图片资源三级缓存
- 蒙层、遮罩、阴影、内外阴影、渐变
- 滤镜
- 放大镜
- 路径动画
- 页面过渡动画
- 自定义动画与关键帧动画
- 视频、音频、截图
- 本地模型与 RAG 知识库
- AI 对话
- AI 绘制
- PSD 文件解析
- 导入与导出

预览页规划：

- 展示制作页的所有能力
- 支持画笔操作
- 支持手势控制
