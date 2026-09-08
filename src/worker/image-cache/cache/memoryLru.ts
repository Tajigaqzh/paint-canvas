type MemoryEntry = {
  blob: Blob;
  byteLength: number;
};

/**
 * L1：按访问顺序淘汰的 Blob 内存缓存。
 * Map 插入顺序即 LRU；命中时删掉再写入即可挪到最新。
 * 只活在图片线程里，刷新页面会丢。
 */
export class BlobMemoryLru {
  private bytes = 0;

  private readonly entries = new Map<string, MemoryEntry>();

  private readonly maxBytes: number;

  private readonly maxEntries: number;

  constructor(maxEntries: number, maxBytes: number) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
  }

  /** 命中后把条目挪到最新。 */
  get(url: string) {
    const entry = this.entries.get(url);

    if (!entry) return undefined;

    this.entries.delete(url);
    this.entries.set(url, entry);
    return entry.blob;
  }

  /** 空 Blob 或超过整仓上限的单张图不写入。 */
  set(url: string, blob: Blob) {
    this.delete(url);

    const byteLength = blob.size;

    if (byteLength <= 0 || byteLength > this.maxBytes) return;

    this.entries.set(url, { blob, byteLength });
    this.bytes += byteLength;
    this.prune();
  }

  delete(url: string) {
    const entry = this.entries.get(url);

    if (!entry) return;

    this.entries.delete(url);
    this.bytes -= entry.byteLength;
  }

  /** 超出条目数或总字节时淘汰最旧项。 */
  private prune() {
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value;

      if (!oldestKey) {
        this.bytes = 0;
        return;
      }

      this.delete(oldestKey);
    }
  }
}
