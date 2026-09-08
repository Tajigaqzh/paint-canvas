import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/worker/registerImageCacheServiceWorker", () => ({
  registerImageCacheServiceWorker: vi.fn(),
}));

import ImageCacheTest from "../index";

describe("ImageCacheTest", () => {
  it("渲染实验页标题区按钮", () => {
    render(<ImageCacheTest />);
    expect(screen.getByText("主线程 fetch")).toBeTruthy();
  });
});
