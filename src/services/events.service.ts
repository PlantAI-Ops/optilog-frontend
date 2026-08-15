import { api } from "@/lib/api-client";
import type {
  EventResponse,
  CreateEventRequest,
  UpdateEventRequest,
  AssignEventRequest,
  ListEventsParams,
  PaginatedResponse,
} from "@/types/api";

export const eventsApi = {
  list(params?: ListEventsParams): Promise<PaginatedResponse<EventResponse>> {
    return api.get("/events", { params: params as Record<string, string | number | boolean | null | undefined> });
  },

  get(id: string): Promise<EventResponse> {
    return api.get(`/events/${id}`);
  },

  create(data: CreateEventRequest): Promise<EventResponse> {
    return api.post("/events", data);
  },

  update(id: string, data: UpdateEventRequest): Promise<EventResponse> {
    return api.patch(`/events/${id}`, data);
  },

  delete(id: string): Promise<{ status: string }> {
    return api.delete(`/events/${id}`);
  },

  confirm(id: string): Promise<{ status: string }> {
    return api.post(`/events/${id}/confirm`);
  },

  reject(id: string): Promise<{ status: string }> {
    return api.post(`/events/${id}/reject`);
  },

  resolve(id: string): Promise<{ status: string }> {
    return api.post(`/events/${id}/resolve`);
  },

  assign(id: string, data: AssignEventRequest): Promise<EventResponse> {
    return api.post(`/events/${id}/assign`, data);
  },

  escalate(id: string): Promise<{ id: string; status: string }> {
    return api.post(`/events/${id}/escalate`);
  },
};
