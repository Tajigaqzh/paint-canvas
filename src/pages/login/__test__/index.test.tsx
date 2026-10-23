import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "@/api/auth";
import { getSession } from "@/api/session";
import LoginPage from "../index";

vi.mock("@/api/auth", () => ({
  authApi: { login: vi.fn(), register: vi.fn() },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.register).mockReset();
  });

  it("登录成功保存账号会话", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: "token-1",
      expiresAt: "2030-01-01T00:00:00Z",
      user: { id: "user-1", email: "user@example.com", displayName: "Canvas User" },
    });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /登\s*录/ }));

    await waitFor(() => expect(getSession()?.user.email).toBe("user@example.com"));
  });

  it("注册模式显示显示名称字段", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("创建账号"));
    expect(screen.getByLabelText("显示名称")).toBeTruthy();
  });
});
