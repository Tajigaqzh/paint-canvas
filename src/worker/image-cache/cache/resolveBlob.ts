import { getIndexedDbBlob, pruneIndexedDbBlobs, putIndexedDbBlob, touchIndexedDbBlob } from "./idb";
import { IDB_MAX_BYTES, IDB_MAX_ENTRIES, MEMORY_MAX_BYTES, MEMORY_MAX_ENTRIES } from "./limits";
import { BlobMemoryLru } from "./memoryLru";
import { DEFAULT_IMAGE_FETCH_INIT } from "../types";
import type { ImageBlobResult, ImageCacheFetchInit } from "../types";

const memory = new BlobMemoryLru(MEMORY_MAX_ENTRIES, MEMORY_MAX_BYTES);
/** 同一 URL 并发 get 合并成一次加载，避免重复 fetch。 */
const inflight = new Map<string, Promise<ImageBlobResult>>();

/** 相对路径按 worker 自身 origin 解析成绝对 URL，作为缓存键。 */
const normalizeImageUrl = (url: string) => {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new Error("图片地址不能为空");
  }

  try {
    return new URL(trimmed, self.location.href).href;
  } catch {
    throw new Error("无效的图片地址");
  }
};

/** 默认参数可被单次 fetchInit 覆盖。 */
const fetchImageBlob = async (url: string, fetchInit?: ImageCacheFetchInit) => {
  const response = await fetch(url, {
    ...DEFAULT_IMAGE_FETCH_INIT,
    ...fetchInit,
  });

  if (!response.ok) {
    throw new Error(`图片请求失败：${response.status}`);
  }

  const blob = await response.blob();

  if (blob.size <= 0) {
    throw new Error("图片响应为空");
  }

  return blob;
};

/** 写入 L2；超大图跳过，避免挤掉整仓。失败不影响本次返回。 */
const persistIndexedDb = async (url: string, blob: Blob) => {
  if (blob.size > IDB_MAX_BYTES) return;

  await putIndexedDbBlob({
    blob,
    byteLength: blob.size,
    contentType: blob.type,
    lastAccessedAt: Date.now(),
    url,
  });
  await pruneIndexedDbBlobs(IDB_MAX_ENTRIES, IDB_MAX_BYTES);
};

/** L1 miss 之后的路径：再查 L2，没有再 fetch，并回写上层缓存。 */
const loadUncached = async (
  url: string,
  fetchInit?: ImageCacheFetchInit,
): Promise<ImageBlobResult> => {
  const memoryHit = memory.get(url);

  if (memoryHit) {
    return { blob: memoryHit, source: "memory" };
  }

  const idbRecord = await getIndexedDbBlob(url);

  if (idbRecord?.blob.size) {
    memory.set(url, idbRecord.blob);
    void touchIndexedDbBlob(url).catch(() => undefined);
    return { blob: idbRecord.blob, source: "idb" };
  }

  const blob = await fetchImageBlob(url, fetchInit);

  memory.set(url, blob);
  void persistIndexedDb(url, blob).catch(() => undefined);
  return { blob, source: "network" };
};

/**
 * L1 内存 → L2 IndexedDB → L3 网络。
 * 同一 URL 的并发请求合并成一次加载。
 * fetchInit 只在真正打网时生效；L1/L2 命中仍按 URL 复用 Blob。
 */
export const resolveImageBlob = (rawUrl: string, fetchInit?: ImageCacheFetchInit) => {
  const url = normalizeImageUrl(rawUrl);
  const memoryHit = memory.get(url);

  if (memoryHit) {
    return Promise.resolve({ blob: memoryHit, source: "memory" as const });
  }

  const pending = inflight.get(url);

  if (pending) return pending;

  const promise = loadUncached(url, fetchInit).finally(() => {
    inflight.delete(url);
  });

  inflight.set(url, promise);
  return promise;
};
