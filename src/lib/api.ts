const TOKEN_KEY = "shiftlog.token.v1";
const REFRESH_TOKEN_KEY = "shiftlog.refresh_token.v1";
const BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        localStorage.removeItem("shiftlog.state.v1");
        window.location.replace("/");
      }
    }
    const message =
      (data && typeof data === "object" && "message" in data
        ? (data as { message: string }).message
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) => apiFetch<T>("POST", path, body),
  patch: <T = unknown>(path: string, body?: unknown) => apiFetch<T>("PATCH", path, body),
  del: <T = unknown>(path: string) => apiFetch<T>("DELETE", path),
};
