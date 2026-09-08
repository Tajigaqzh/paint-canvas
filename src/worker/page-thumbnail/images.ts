/**
 * 缩略图线程取图：只通过已绑定的 ImageCachePortClient 要 Blob，再在本线程 decode。
 */
import type { CanvasNode, CanvasPage, ImageNode } from "@/types";
import type { ImageCachePortClient } from "@/worker/image-cache/client";

export const isImageNode = (node: CanvasNode): node is ImageNode => node.kind === "image";

/** 收集本页所有图片 src，去重后一次请求。 */
const collectPageImageUrls = (page: CanvasPage) => {
  const urls: string[] = [];

  Object.values(page.nodeMap).forEach((node) => {
    if (isImageNode(node) && node.src) {
      urls.push(node.src);
    }
  });

  return [...new Set(urls)];
};

/**
 * 向图片缓存线程要本页所有图片 Blob，并在缩略图线程解码成 ImageBitmap。
 * 单张失败时跳过，渲染时画灰色占位。
 */
export const loadPageImages = async (page: CanvasPage, client?: ImageCachePortClient) => {
  const images = new Map<string, ImageBitmap>();

  if (!client) return images;

  await Promise.all(
    collectPageImageUrls(page).map(async (url) => {
      try {
        const { blob } = await client.getBlob(url);
        images.set(url, await createImageBitmap(blob));
      } catch {
        // 单张失败不阻断整页缩略图。
      }
    }),
  );

  return images;
};

/** 渲染结束后关闭本页 ImageBitmap，避免 worker 内泄漏。 */
export const closePageImages = (images?: Map<string, ImageBitmap>) => {
  images?.forEach((image) => image.close());
};
