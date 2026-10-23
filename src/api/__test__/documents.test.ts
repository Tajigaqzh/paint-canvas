import axios, { AxiosHeaders, type AxiosAdapter } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { CanvasDocument } from "@/types";
import { createDocumentsApi } from "../documents";
import { createRequest } from "../httpClient";

const documentData: CanvasDocument = {
  activePageId: "page-1",
  pageIds: ["page-1"],
  pages: {} as CanvasDocument["pages"],
};

const createTestApi = () => {
  const adapter: AxiosAdapter = vi.fn(async (config) => ({
    config,
    data: {},
    headers: new AxiosHeaders(),
    status: 200,
    statusText: "OK",
  }));
  const request = createRequest(axios.create({ baseURL: "http://localhost:8080", adapter }));

  return { adapter, api: createDocumentsApi(request) };
};

describe("documentsApi", () => {
  it("列表请求带 limit 和 offset 参数", async () => {
    const { adapter, api } = createTestApi();

    await api.list({ limit: 10, offset: 20 });

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { limit: 10, offset: 20 },
        url: "/api/v1/documents",
      }),
    );
  });

  it("创建文档发送名称和 CanvasDocument", async () => {
    const { adapter, api } = createTestApi();

    await api.create({ name: "Demo", data: documentData });

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        data: JSON.stringify({ name: "Demo", data: documentData }),
      }),
    );
  });

  it("读取文档时对 ID 做 URL 编码", async () => {
    const { adapter, api } = createTestApi();

    await api.get("doc/1");

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/documents/doc%2F1",
      }),
    );
  });

  it("更新文档时携带 revision", async () => {
    const { adapter, api } = createTestApi();

    await api.update("doc-1", { name: "Demo", data: documentData, revision: 3 });

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "put",
        data: JSON.stringify({ name: "Demo", data: documentData, revision: 3 }),
      }),
    );
  });

  it("删除文档使用 DELETE", async () => {
    const { adapter, api } = createTestApi();

    await api.delete("doc-1");

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: "delete" }));
  });
});
