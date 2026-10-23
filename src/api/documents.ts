import type { CanvasDocument } from "@/types";
import { request, type createRequest } from "./httpClient";

export type DocumentRecord = {
  id: string;
  name: string;
  data: CanvasDocument;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSummary = Omit<DocumentRecord, "data">;

export type DocumentList = {
  items: DocumentSummary[];
  limit: number;
  offset: number;
};

export type CreateDocumentInput = {
  name: string;
  data: CanvasDocument;
};

export type UpdateDocumentInput = CreateDocumentInput & {
  revision: number;
};

type Request = ReturnType<typeof createRequest>;

export const createDocumentsApi = (client: Request = request) => ({
  list(params: { limit?: number; offset?: number } = {}) {
    return client.get<DocumentList>("/api/v1/documents", { params });
  },
  create(input: CreateDocumentInput) {
    return client.post<DocumentRecord>("/api/v1/documents", input);
  },
  get(id: string) {
    return client.get<DocumentRecord>(`/api/v1/documents/${encodeURIComponent(id)}`);
  },
  update(id: string, input: UpdateDocumentInput) {
    return client.put<DocumentRecord>(`/api/v1/documents/${encodeURIComponent(id)}`, input);
  },
  delete(id: string) {
    return client.delete<void>(`/api/v1/documents/${encodeURIComponent(id)}`);
  },
});

export const documentsApi = createDocumentsApi();
