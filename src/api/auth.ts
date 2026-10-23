import { request } from "./httpClient";
import type { AuthSession, AuthUser } from "./session";

export type AuthInput = {
  email: string;
  password: string;
  displayName?: string;
};

export type AuthResponse = AuthSession & {
  expiresAt: string;
};

export const authApi = {
  register(input: AuthInput) {
    return request.post<AuthResponse>("/api/v1/auth/register", input);
  },
  login(input: AuthInput) {
    return request.post<AuthResponse>("/api/v1/auth/login", input);
  },
  me() {
    return request.get<AuthUser>("/api/v1/auth/me");
  },
};
