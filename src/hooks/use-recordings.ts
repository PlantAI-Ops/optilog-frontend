import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recordingsApi } from "@/services/recordings.service";

export function useRecording(id: string) {
  return useQuery({
    queryKey: ["recordings", id],
    queryFn: () => recordingsApi.get(id),
    enabled: !!id,
  });
}

export function useUploadRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, plantId, shiftId }: { file: File; plantId?: string; shiftId?: string }) =>
      recordingsApi.upload(file, plantId, shiftId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}

export function useRetryUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordingsApi.retryUpload(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}

export function useRetryTranscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordingsApi.retryTranscribe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}

export function useExtractRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordingsApi.extract(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recordings"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
