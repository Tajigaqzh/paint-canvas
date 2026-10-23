import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { getSession, setSession } from "./session";

export type ApiErrorBody = {
  error?: string;
  message?: string;
};

export class ApiError extends Error {
  readonly status: number;

  readonly code?: string;

  readonly body?: unknown;

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getSession()?.token;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/")
    ) {
      setSession(null);
    }
    return Promise.reject(error);
  },
);

const toApiError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : "Request failed", 0);
  }

  const axiosError = error as AxiosError<ApiErrorBody | string>;
  const body = axiosError.response?.data;
  const errorBody = typeof body === "object" && body !== null ? body : undefined;
  const status = axiosError.response?.status ?? 0;

  return new ApiError(
    errorBody?.message ?? (typeof body === "string" ? body : axiosError.message),
    status,
    errorBody?.error,
    body,
  );
};

export const createRequest = (client: AxiosInstance) => ({
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      return (await client.get<T>(url, config)).data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      return (await client.post<T>(url, data, config)).data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      return (await client.put<T>(url, data, config)).data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      return (await client.delete<T>(url, config)).data;
    } catch (error) {
      throw toApiError(error);
    }
  },
});

export const request = createRequest(apiClient);
