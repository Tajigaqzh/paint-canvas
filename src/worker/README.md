# Worker

制作页用 Dedicated Worker 分担两件事：远程图片缓存、底部缩略图绘制。实验用的 Service Worker 仍在 `public/image-cache-sw.js`，应用启动时不注册。

```text
worker/
  image-cache/                         图片 Dedicated Worker（主线程单例）
    types.ts / client.ts / workerManager.ts / imageCache.worker.ts
    cache/                             仅在图片线程里跑的三级缓存
  page-thumbnail/                      页面缩略图 Dedicated Worker（最多 3 个）
    types.ts / workerManager.ts / pageThumbnail.worker.ts / images.ts
    render/                            仅在缩略图线程里跑的 Canvas 2D 绘制
  registerImageCacheServiceWorker.ts   实验页注册 SW，制作页不用
```

主画布：`getImageBlob` → `URL.createObjectURL` → Leafer。缩略图：主线程转交 `MessagePort` 后，page-thumbnail worker 直连图片线程要 Blob，再 `createImageBitmap`。素材面板 `<img>` 不走这套缓存。
