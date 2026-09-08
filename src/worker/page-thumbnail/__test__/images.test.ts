import { describe, expect, it, vi } from "vitest";
import type { CanvasPage, ImageNode } from "@/types";
import { closePageImages, isImageNode, loadPageImages } from "../images";

const pageWith = (nodes: CanvasPage["nodeMap"]): CanvasPage => ({
  id: "p",
  name: "p",
  nodeMap: nodes,
  rootIds: Object.keys(nodes),
  selectedIds: [],
  viewport: { height: 1080, width: 1920 },
});

const imageNode = (id: string, src: string): ImageNode => ({
  animationList: [],
  height: 10,
  id,
  kind: "image",
  name: id,
  rotation: 0,
  src,
  transformOrigin: "center",
  width: 10,
  x: 0,
  y: 0,
});

describe("isImageNode", () => {
  it("image 节点为 true", () => {
    expect(isImageNode(imageNode("i", "https://a"))).toBe(true);
  });

  it("rect 节点为 false", () => {
    expect(
      isImageNode({
        animationList: [],
        fill: "#fff",
        height: 1,
        id: "r",
        kind: "rect",
        name: "r",
        rotation: 0,
        transformOrigin: "center",
        width: 1,
        x: 0,
        y: 0,
      }),
    ).toBe(false);
  });
});

describe("loadPageImages", () => {
  it("没有 client 返回空 Map", async () => {
    const images = await loadPageImages(pageWith({ i: imageNode("i", "https://a") }));
    expect(images.size).toBe(0);
  });

  it("client 成功时按 url 解码", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close })),
    );
    const client = {
      getBlob: vi.fn(async () => ({ blob: new Blob(["x"]), source: "memory" as const })),
    };
    const images = await loadPageImages(
      pageWith({ i: imageNode("i", "https://a") }),
      client as never,
    );
    expect(images.has("https://a")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("单张失败不阻断其它图", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn() })),
    );
    const client = {
      getBlob: vi.fn(async (url: string) => {
        if (url === "https://bad") throw new Error("fail");
        return { blob: new Blob(["x"]), source: "network" as const };
      }),
    };
    const images = await loadPageImages(
      pageWith({
        a: imageNode("a", "https://ok"),
        b: imageNode("b", "https://bad"),
      }),
      client as never,
    );
    expect(images.has("https://ok")).toBe(true);
    expect(images.has("https://bad")).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("closePageImages", () => {
  it("undefined 不抛错", () => {
    expect(() => closePageImages(undefined)).not.toThrow();
  });

  it("会 close 每一张 ImageBitmap", () => {
    const close = vi.fn();
    closePageImages(new Map([["https://a", { close } as never]]));
    expect(close).toHaveBeenCalled();
  });
});
