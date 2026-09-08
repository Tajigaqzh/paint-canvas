# 页面缩略图线程

底部页条用 Dedicated Worker 画 OffscreenCanvas，最多 3 个。主线程只调度任务、接收 `ImageBitmap`，不自己画节点。

图片不在这里 `fetch`：启动时由主线程把图片缓存 worker 的 `MessagePort` 转交过来，渲染前按页要 Blob 再解码。

```text
page-thumbnail/
  types.ts                    主线程 ↔ worker 消息协议
  workerManager.ts            主线程队列、worker 池、bind 图片缓存
  pageThumbnail.worker.ts     消息入口：bind / render
  images.ts                   按页取 Blob、解码、释放
  render/                     仅在缩略图线程里跑的 Canvas 2D 绘制
    types.ts                  绘制上下文类型
    context.ts                坐标、圆角、描边/填充
    ellipse.ts / line.ts / polygon.ts
    node.ts                   按 kind 分发
    index.ts                  renderPage
  index.ts                    主线程对外入口
```

主线程：

```ts
import { PageThumbnailWorkerManager } from "@/worker/page-thumbnail";
```

新增节点类型时，同步改 `render/node.ts` 和对应 shape 文件。
