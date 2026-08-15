import { api } from "@/lib/api-client";
import type { RecordingResponse } from "@/types/api";

export const recordingsApi = {
  upload(file: File, plantId?: string, shiftId?: string): Promise<RecordingResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (plantId) formData.append("plant_id", plantId);
    if (shiftId) formData.append("shift_id", shiftId);
    return api.post("/recordings", formData);
  },

  get(id: string): Promise<RecordingResponse> {
    return api.get(`/recordings/${id}`);
  },

  retryUpload(id: string): Promise<RecordingResponse> {
    return api.post(`/recordings/${id}/retry-upload`);
  },

  retryTranscribe(id: string): Promise<RecordingResponse> {
    return api.post(`/recordings/${id}/retry-transcribe`);
  },

  extract(id: string): Promise<RecordingResponse> {
    return api.post(`/recordings/${id}/extract`);
  },
};
