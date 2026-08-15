import { api } from "@/lib/api-client";
import type { AttachmentResponse, AttachmentUrlResponse } from "@/types/api";

export const attachmentsApi = {
  upload(file: File, eventId?: string, recordingId?: string): Promise<AttachmentResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (eventId) formData.append("event_id", eventId);
    if (recordingId) formData.append("recording_id", recordingId);
    return api.post("/attachments", formData);
  },

  list(params?: { event_id?: string; recording_id?: string }): Promise<AttachmentResponse[]> {
    return api.get("/attachments", { params: params as Record<string, string | number | boolean | null | undefined> });
  },

  getUrl(id: string): Promise<AttachmentUrlResponse> {
    return api.get(`/attachments/${id}/url`);
  },
};
