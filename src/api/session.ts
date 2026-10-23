export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const SESSION_STORAGE_KEY = "paint-canvas:session";
let session: AuthSession | null = readSession();
const listeners = new Set<() => void>();

function readSession(): AuthSession | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const value = localStorage.getItem(SESSION_STORAGE_KEY);
    return value ? (JSON.parse(value) as AuthSession) : null;
  } catch {
    return null;
  }
}

export const getSession = () => session;

export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setSession = (next: AuthSession | null) => {
  session = next;
  if (typeof localStorage !== "undefined") {
    if (next) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
};

export const useAuthSession = () => useSyncExternalStore(subscribeSession, getSession, () => null);
import { useSyncExternalStore } from "react";
