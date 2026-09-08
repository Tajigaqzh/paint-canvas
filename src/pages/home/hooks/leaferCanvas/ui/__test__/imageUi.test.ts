import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageNode, ManagedNodeUI } from "@/types";
import { getImageBlob } from "@/worker/image-cache";
import { disposeAllImageSources, disposeImageSource, syncImageSource } from "../imageUi";

vi.mock("@/worker/image-cache", () => ({
  getImageBlob: vi.fn(),
}));

const image = (src: string): ImageNode => ({
  animationList: [],
  height: 10,
  id: "img",
  kind: "image",
  name: "图",
  rotation: 0,
  src,
  transformOrigin: "center",
  width: 10,
  x: 0,
  y: 0,
});

describe("imageUi", () => {
  afterEach(() => {
    disposeAllImageSources(new Map());
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("getImageBlob 失败时把 url 置空", async () => {
    vi.mocked(getImageBlob).mockRejectedValueOnce(new Error("fail"));
    const ui = { url: "old" } as ManagedNodeUI;

    syncImageSource("n1", ui, image("https://a"));
    await vi.waitFor(() => {
      expect(ui.url).toBe("");
    });
  });

  it("成功时赋上 object URL", async () => {
    vi.mocked(getImageBlob).mockResolvedValueOnce({ blob: new Blob(["x"]), source: "network" });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
    const ui = { url: "" } as ManagedNodeUI;

    syncImageSource("n2", ui, image("https://b"));
    await vi.waitFor(() => {
      expect(ui.url).toBe("blob:test");
    });
  });

  it("dispose 未知 id 不 revoke", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(), revokeObjectURL });
    disposeImageSource("missing", { url: "blob:keep" } as ManagedNodeUI);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
