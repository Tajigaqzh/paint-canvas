import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveImageBlob } from "../resolveBlob";

vi.mock("../idb", () => ({
  getIndexedDbBlob: vi.fn(async () => undefined),
  pruneIndexedDbBlobs: vi.fn(async () => undefined),
  putIndexedDbBlob: vi.fn(async () => undefined),
  touchIndexedDbBlob: vi.fn(async () => undefined),
}));

const okBlob = (size = 8) => new Blob([new Uint8Array(size)]);

describe("resolveImageBlob", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("空字符串抛「图片地址不能为空」", () => {
    expect(() => resolveImageBlob("")).toThrow("图片地址不能为空");
  });

  it("空白字符串抛「图片地址不能为空」", () => {
    expect(() => resolveImageBlob("   ")).toThrow("图片地址不能为空");
  });

  it("非法地址抛「无效的图片地址」", () => {
    expect(() => resolveImageBlob("http://[")).toThrow("无效的图片地址");
  });

  it("网络成功返回 source network", async () => {
    const url = `https://example.com/${crypto.randomUUID()}.png`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => okBlob(),
        ok: true,
      })),
    );

    await expect(resolveImageBlob(url)).resolves.toMatchObject({ source: "network" });
  });

  it("HTTP 非 2xx 抛请求失败", async () => {
    const url = `https://example.com/${crypto.randomUUID()}.png`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => okBlob(),
        ok: false,
        status: 404,
      })),
    );

    await expect(resolveImageBlob(url)).rejects.toThrow("图片请求失败：404");
  });

  it("空响应体抛「图片响应为空」", async () => {
    const url = `https://example.com/${crypto.randomUUID()}.png`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => okBlob(0),
        ok: true,
      })),
    );

    await expect(resolveImageBlob(url)).rejects.toThrow("图片响应为空");
  });

  it("第二次同 URL 走内存不再 fetch", async () => {
    const url = `https://example.com/${crypto.randomUUID()}.png`;
    const fetchMock = vi.fn(async () => ({
      blob: async () => okBlob(),
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await resolveImageBlob(url);
    const second = await resolveImageBlob(url);

    expect(second.source).toBe("memory");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("并发同 URL 只 fetch 一次", async () => {
    const url = `https://example.com/${crypto.randomUUID()}.png`;
    const fetchMock = vi.fn(
      async () =>
        new Promise<{ blob: () => Promise<Blob>; ok: boolean }>((resolve) => {
          setTimeout(() => {
            resolve({ blob: async () => okBlob(), ok: true });
          }, 20);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [left, right] = await Promise.all([resolveImageBlob(url), resolveImageBlob(url)]);

    expect(left.blob).toBe(right.blob);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
