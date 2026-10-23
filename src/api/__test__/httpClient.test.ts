import axios, { AxiosHeaders, type AxiosAdapter } from "axios";
import { describe, expect, it, vi } from "vitest";
import { createRequest } from "../httpClient";

const createTestRequest = (data: unknown, status = 200) => {
  const adapter: AxiosAdapter = vi.fn(async (config) => ({
    config,
    data,
    headers: new AxiosHeaders(),
    status,
    statusText: "OK",
  }));
  const client = axios.create({ baseURL: "http://localhost:8080", adapter });

  return { adapter, request: createRequest(client) };
};

describe("request", () => {
  it("返回响应 data 并使用 Axios baseURL", async () => {
    const { adapter, request } = createTestRequest({ value: 1 });

    await expect(request.get("/api/test")).resolves.toEqual({ value: 1 });
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:8080",
        url: "/api/test",
        method: "get",
      }),
    );
  });

  it("POST 会序列化 JSON body", async () => {
    const { adapter, request } = createTestRequest({ id: "doc-1" }, 201);

    await request.post("/api/v1/documents", { name: "Demo" });

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        data: '{"name":"Demo"}',
        method: "post",
      }),
    );
  });

  it("Go API 的 JSON 错误转换为 ApiError", async () => {
    const adapter: AxiosAdapter = vi.fn(async (config) => {
      const response = {
        config,
        data: { error: "revision_conflict", message: "reload first" },
        headers: new AxiosHeaders(),
        status: 409,
        statusText: "Conflict",
      };

      throw new axios.AxiosError(
        "Request failed with status code 409",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        response,
      );
    });
    const request = createRequest(axios.create({ adapter }));

    await expect(request.get("/api/test")).rejects.toMatchObject({
      name: "ApiError",
      message: "reload first",
      status: 409,
      code: "revision_conflict",
    });
  });

  it("网络失败转换为 status 0 的 ApiError", async () => {
    const adapter: AxiosAdapter = vi.fn(async () => {
      throw new Error("Network Error");
    });
    const request = createRequest(axios.create({ adapter }));

    await expect(request.get("/api/test")).rejects.toMatchObject({
      status: 0,
      message: "Network Error",
    });
  });
});
