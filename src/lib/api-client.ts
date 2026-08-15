import type { ApiError, TokenResponse } from "@/types/api";

const BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000/api/v1";

// ─── Token storage ───────────────────────────────────────────────────────────

const TOKEN_KEY = "optilog.access_token";
const REFRESH_KEY = "optilog.refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  client_type?: string;
  exp: number;
  type: "access" | "refresh";
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload) return true;
  return Date.now() >= payload.exp * 1000 - 30_000; // 30s buffer
}

// ─── Client type detection ───────────────────────────────────────────────────

export function getClientType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const path = window.location.pathname;
  return path.startsWith("/console") ? "desktop" : "mobile";
}

// ─── Refresh queue ───────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<TokenResponse> | null = null;
const pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function notifyPending(error?: unknown) {
  pendingRequests.forEach((p) => (error ? p.reject(error) : p.resolve(getAccessToken()!)));
  pendingRequests.length = 0;
}

async function refreshAccessToken(): Promise<TokenResponse> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token");

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh, client_type: getClientType() }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error("Refresh failed");
  }

  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

// ─── Main fetch wrapper ──────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions extends Omit<RequestInit, "method" | "body"> {
  params?: Record<string, string | number | boolean | null | undefined>;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value != null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const init: RequestInit = {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : null,
    ...options,
  };

  let res = await fetch(url.toString(), init);

  // Handle 401 — try refresh once
  if (res.status === 401 && getRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken()
        .then((data) => {
          notifyPending();
          return data;
        })
        .catch((err) => {
          notifyPending(err);
          throw err;
        })
        .finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
    }

    if (refreshPromise) {
      await new Promise<void>((resolve, reject) => {
        pendingRequests.push({
          resolve: () => resolve(),
          reject: (err) => reject(err),
        });
      });

      // Retry the original request with new token
      const newToken = getAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(url.toString(), { ...init, headers });
      }
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err: ApiError = await res.json();
      detail = err.detail || detail;
    } catch {
      // ignore parse error
    }
    throw new ApiRequestError(res.status, detail);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Typed helpers ───────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, undefined, opts),
};
