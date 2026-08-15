import { api } from "@/lib/api-client";
import type {
  ActionResponse,
  CreateActionRequest,
  UpdateActionRequest,
  ListActionsParams,
  PaginatedResponse,
} from "@/types/api";

export const actionsApi = {
  list(params?: ListActionsParams): Promise<PaginatedResponse<ActionResponse>> {
    return api.get("/actions", { params: params as Record<string, string | number | boolean | null | undefined> });
  },

  get(id: string): Promise<ActionResponse> {
    return api.get(`/actions/${id}`);
  },

  create(data: CreateActionRequest): Promise<ActionResponse> {
    return api.post("/actions", data);
  },

  update(id: string, data: UpdateActionRequest): Promise<ActionResponse> {
    return api.patch(`/actions/${id}`, data);
  },

  complete(id: string): Promise<{ status: string; completed_at: string }> {
    return api.post(`/actions/${id}/complete`);
  },
};
