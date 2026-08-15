import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachmentsApi } from "@/services/attachments.service";

export function useAttachments(params?: { event_id?: string; recording_id?: string }) {
  return useQuery({
    queryKey: ["attachments", params],
    queryFn: () => attachmentsApi.list(params),
    enabled: !!(params?.event_id || params?.recording_id),
  });
}

export function useAttachmentUrl(id: string) {
  return useQuery({
    queryKey: ["attachments", id, "url"],
    queryFn: () => attachmentsApi.getUrl(id),
    enabled: !!id,
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, eventId, recordingId }: { file: File; eventId?: string; recordingId?: string }) =>
      attachmentsApi.upload(file, eventId, recordingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments"] }),
  });
}
