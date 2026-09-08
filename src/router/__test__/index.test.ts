import { describe, expect, it } from "vitest";
import { routes } from "../index";

describe("routes", () => {
  it("根路径挂制作页", () => {
    expect(routes[0]?.path).toBe("/");
  });

  it("包含图片缓存实验页", () => {
    const childPaths = routes[0]?.children?.map((route) => route.path);
    expect(childPaths).toContain("image-cache-worker-test");
  });
});
