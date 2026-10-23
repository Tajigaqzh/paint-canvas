import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSession } from "@/api/session";
import WorksPage from "../index";

const { mockDocumentsApi } = vi.hoisted(() => ({
  mockDocumentsApi: { delete: vi.fn(), list: vi.fn() },
}));
vi.mock("@/api/documents", () => ({ documentsApi: mockDocumentsApi }));
vi.mock("@/hooks/useAppMessage", () => ({
  useAppMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}));

describe("WorksPage", () => {
  beforeEach(() => {
    localStorage.clear();
    setSession({
      token: "test-token",
      user: { id: "user-1", email: "artist@example.com", displayName: "Artist" },
    });
    mockDocumentsApi.list.mockReset();
    mockDocumentsApi.delete.mockReset();
    mockDocumentsApi.list.mockResolvedValue({
      items: [{ id: "work-1", name: "Poster", revision: 1, updatedAt: "2026-10-23T00:00:00Z" }],
      limit: 100,
      offset: 0,
    });
  });

  it("查询账号作品并显示登录人头像", async () => {
    render(
      <MemoryRouter>
        <WorksPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(mockDocumentsApi.list).toHaveBeenCalledWith({ limit: 100, offset: 0 }),
    );
    expect(screen.getByText("Poster")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("artist@example.com")).toBeTruthy();
  });

  it("列表错误由页面错误态消息处理", async () => {
    mockDocumentsApi.list.mockRejectedValue(new Error("offline"));
    render(
      <MemoryRouter>
        <WorksPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mockDocumentsApi.list).toHaveBeenCalled());
  });
});
