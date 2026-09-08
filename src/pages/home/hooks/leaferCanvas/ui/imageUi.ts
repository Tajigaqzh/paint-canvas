import type { ImageNode, ManagedNodeUI } from "@/types";
import { getImageBlob } from "@/worker/image-cache";

type ImageSourceState = {
  generation: number;
  objectUrl?: string;
  src: string;
};

const imageSourceMap = new Map<string, ImageSourceState>();

/**
 * Leafer destroy Image 不会立刻丢掉 blob: 引用。
 * 先把 url 置空，再 revokeObjectURL，浏览器才会释放这张图的解码内存。
 */
const detachAndRevokeObjectUrl = (ui: ManagedNodeUI | undefined, objectUrl?: string) => {
  if (!objectUrl) return;

  if (ui && ui.url === objectUrl) {
    ui.url = "";
  }

  URL.revokeObjectURL(objectUrl);
};

/**
 * Leafer Image 的 url 只接收字符串。
 * 缓存线程给出 Blob 后，用 createObjectURL 转成 blob: 地址再赋给 Image.url。
 */
const applyBlobToLeaferImage = (ui: ManagedNodeUI, blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob);

  ui.url = objectUrl;
  return objectUrl;
};

/**
 * 用图片缓存线程的 Blob 更新 Leafer Image，不要把远程 src 直接交给 Leafer。
 */
export const syncImageSource = (nodeId: string, ui: ManagedNodeUI, node: ImageNode) => {
  const current = imageSourceMap.get(nodeId);

  if (current?.src === node.src && current.objectUrl) {
    if (ui.url !== current.objectUrl) {
      ui.url = current.objectUrl;
    }
    return;
  }

  detachAndRevokeObjectUrl(ui, current?.objectUrl);

  const generation = (current?.generation ?? 0) + 1;

  imageSourceMap.set(nodeId, {
    generation,
    src: node.src,
  });

  void getImageBlob(node.src)
    .then(({ blob }) => {
      const state = imageSourceMap.get(nodeId);

      if (!state || state.src !== node.src || state.generation !== generation) return;

      state.objectUrl = applyBlobToLeaferImage(ui, blob);
    })
    .catch(() => {
      const state = imageSourceMap.get(nodeId);

      if (!state || state.generation !== generation) return;

      ui.url = "";
    });
};

/** 删除节点或 kind 替换时：先断开 Leafer url，再 revoke。必须在 ui.destroy() 之前调用。 */
export const disposeImageSource = (nodeId: string, ui?: ManagedNodeUI) => {
  const state = imageSourceMap.get(nodeId);

  detachAndRevokeObjectUrl(ui, state?.objectUrl);
  imageSourceMap.delete(nodeId);
};

/** App 卸载时释放本页全部 blob URL。 */
export const disposeAllImageSources = (uiMap: Map<string, ManagedNodeUI>) => {
  [...imageSourceMap.keys()].forEach((nodeId) => {
    disposeImageSource(nodeId, uiMap.get(nodeId));
  });
};
