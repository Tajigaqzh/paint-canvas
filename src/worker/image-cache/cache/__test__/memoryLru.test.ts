import { describe, expect, it } from "vitest";
import { BlobMemoryLru } from "../memoryLru";

const blobOf = (size: number) => new Blob([new Uint8Array(size)]);

describe("BlobMemoryLru", () => {
  it("未写入时 get 返回 undefined", () => {
    const cache = new BlobMemoryLru(2, 100);
    expect(cache.get("https://a")).toBeUndefined();
  });

  it("命中后仍返回同一 Blob", () => {
    const cache = new BlobMemoryLru(2, 100);
    const blob = blobOf(10);
    cache.set("https://a", blob);
    expect(cache.get("https://a")).toBe(blob);
  });

  it("空 Blob 不写入", () => {
    const cache = new BlobMemoryLru(2, 100);
    cache.set("https://a", blobOf(0));
    expect(cache.get("https://a")).toBeUndefined();
  });

  it("单张超过总上限不写入", () => {
    const cache = new BlobMemoryLru(2, 10);
    cache.set("https://a", blobOf(11));
    expect(cache.get("https://a")).toBeUndefined();
  });

  it("超出条目数淘汰最旧", () => {
    const cache = new BlobMemoryLru(1, 1000);
    cache.set("https://old", blobOf(10));
    cache.set("https://new", blobOf(10));
    expect(cache.get("https://old")).toBeUndefined();
    expect(cache.get("https://new")).toBeDefined();
  });

  it("delete 不存在的 key 不抛错", () => {
    const cache = new BlobMemoryLru(2, 100);
    expect(() => cache.delete("missing")).not.toThrow();
  });

  it("delete 后 get 为 undefined", () => {
    const cache = new BlobMemoryLru(2, 100);
    cache.set("https://a", blobOf(10));
    cache.delete("https://a");
    expect(cache.get("https://a")).toBeUndefined();
  });
});
