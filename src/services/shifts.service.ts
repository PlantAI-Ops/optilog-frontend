import { api } from "@/lib/api-client";
import type {
  ShiftResponse,
  CreateShiftRequest,
  SubmitHandoverRequest,
  ShiftTimelineEntry,
  ShiftSummary,
  ListShiftsParams,
  PaginatedResponse,
} from "@/types/api";

export const shiftsApi = {
  list(params: ListShiftsParams): Promise<PaginatedResponse<ShiftResponse>> {
    return api.get("/shifts", { params: params as unknown as Record<string, string | number | boolean | null | undefined> });
  },

  get(id: string): Promise<ShiftResponse> {
    return api.get(`/shifts/${id}`);
  },

  create(data: CreateShiftRequest): Promise<ShiftResponse> {
    return api.post("/shifts", data);
  },

  start(id: string): Promise<ShiftResponse> {
    return api.post(`/shifts/${id}/start`);
  },

  handover(id: string, data: SubmitHandoverRequest): Promise<ShiftResponse> {
    return api.post(`/shifts/${id}/handover`, data);
  },

  close(id: string): Promise<ShiftResponse> {
    return api.post(`/shifts/${id}/close`);
  },

  timeline(id: string): Promise<ShiftTimelineEntry[]> {
    return api.get(`/shifts/${id}/timeline`);
  },

  summary(id: string): Promise<ShiftSummary> {
    return api.get(`/shifts/${id}/summary`);
  },
};
