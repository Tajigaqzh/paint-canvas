/**
 * L2：同源 IndexedDB 存 Blob，刷新后仍可用。
 * 库名 `paint-canvas-image-blobs`，以 url 为主键。
 */

/** 写入 IndexedDB 的一条图片记录。 */
export type ImageCacheRecord = {
  blob: Blob;
  byteLength: number;
  contentType: string;
  /** 用于超限时按最少使用淘汰。 */
  lastAccessedAt: number;
  url: string;
};

const DB_NAME = "paint-canvas-image-blobs";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

/** 打开（或复用）同一个 IDB 连接。 */
const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "url" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("无法打开图片 IndexedDB"));
    });
  }

  return dbPromise;
};

/** 把一次 objectStore 请求包成 Promise。 */
const runStoreRequest = <T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
) =>
  new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("图片 IndexedDB 读写失败"));
  });

export const getIndexedDbBlob = async (url: string) => {
  const db = await openDb();

  return runStoreRequest<ImageCacheRecord | undefined>(db, "readonly", (store) => store.get(url));
};

export const putIndexedDbBlob = async (record: ImageCacheRecord) => {
  const db = await openDb();

  await runStoreRequest(db, "readwrite", (store) => store.put(record));
};

/** 命中 L2 后刷新访问时间，供后续 prune 使用。 */
export const touchIndexedDbBlob = async (url: string) => {
  const record = await getIndexedDbBlob(url);

  if (!record) return;

  await putIndexedDbBlob({
    ...record,
    lastAccessedAt: Date.now(),
  });
};

/** 按 lastAccessedAt 从旧到新删，直到条目数和总字节都回到上限内。 */
export const pruneIndexedDbBlobs = async (maxEntries: number, maxBytes: number) => {
  const db = await openDb();
  const records = await runStoreRequest<ImageCacheRecord[]>(db, "readonly", (store) =>
    store.getAll(),
  );
  const sorted = [...records].sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
  let totalBytes = sorted.reduce((sum, record) => sum + record.byteLength, 0);
  const keysToDelete: string[] = [];

  while (sorted.length > maxEntries || totalBytes > maxBytes) {
    const oldest = sorted.shift();

    if (!oldest) break;

    keysToDelete.push(oldest.url);
    totalBytes -= oldest.byteLength;
  }

  if (keysToDelete.length === 0) return;

  await Promise.all(
    keysToDelete.map((url) => runStoreRequest(db, "readwrite", (store) => store.delete(url))),
  );
};
