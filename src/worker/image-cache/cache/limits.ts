/**
 * L1 / L2 容量上限。
 * 单张图大于对应层 maxBytes 时跳过写入，避免一块超大图挤掉整个缓存。
 */

/** L1 内存最多条目数。 */
export const MEMORY_MAX_ENTRIES = 80;

/** L1 内存最多占用字节。 */
export const MEMORY_MAX_BYTES = 64 * 1024 * 1024;

/** L2 IndexedDB 最多条目数。 */
export const IDB_MAX_ENTRIES = 400;

/** L2 IndexedDB 最多占用字节。 */
export const IDB_MAX_BYTES = 256 * 1024 * 1024;
