import { api } from "@/lib/api-client";
import type {
  LoginRequest,
  TokenResponse,
  RefreshRequest,
  UpdateMeRequest,
  UserResponse,
  RegisterRequest,
  CreateUserRequest,
  UpdateUserRequest,
  PaginatedResponse,
  PaginationParams,
} from "@/types/api";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login(email: string, password: string, clientType?: string): Promise<TokenResponse> {
    const body: LoginRequest = { email, password, client_type: clientType as "mobile" | "desktop" };
    return api.post("/auth/login", body);
  },

  refresh(refreshToken: string, clientType?: string): Promise<TokenResponse> {
    const body: RefreshRequest = { refresh_token: refreshToken, client_type: clientType as "mobile" | "desktop" };
    return api.post("/auth/refresh", body);
  },

  getMe(): Promise<UserResponse> {
    return api.get("/auth/me");
  },

  updateMe(data: UpdateMeRequest): Promise<UserResponse> {
    return api.patch("/auth/me", data);
  },

  register(data: RegisterRequest): Promise<UserResponse> {
    return api.post("/auth/register", data);
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  list(params?: PaginationParams): Promise<PaginatedResponse<UserResponse>> {
    return api.get("/users", { params: params as Record<string, string | number | boolean | null | undefined> });
  },

  get(id: string): Promise<UserResponse> {
    return api.get(`/users/${id}`);
  },

  create(data: CreateUserRequest): Promise<UserResponse> {
    return api.post("/users", data);
  },

  update(id: string, data: UpdateUserRequest): Promise<UserResponse> {
    return api.patch(`/users/${id}`, data);
  },
};
