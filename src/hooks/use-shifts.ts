import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shiftsApi } from "@/services/shifts.service";
import type { CreateShiftRequest, SubmitHandoverRequest, ListShiftsParams } from "@/types/api";

export function useShifts(params: ListShiftsParams) {
  return useQuery({
    queryKey: ["shifts", params],
    queryFn: () => shiftsApi.list(params),
  });
}

export function useShift(id: string) {
  return useQuery({
    queryKey: ["shifts", id],
    queryFn: () => shiftsApi.get(id),
    enabled: !!id,
  });
}

export function useShiftTimeline(id: string) {
  return useQuery({
    queryKey: ["shifts", id, "timeline"],
    queryFn: () => shiftsApi.timeline(id),
    enabled: !!id,
  });
}

export function useShiftSummary(id: string) {
  return useQuery({
    queryKey: ["shifts", id, "summary"],
    queryFn: () => shiftsApi.summary(id),
    enabled: !!id,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateShiftRequest) => shiftsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useStartShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shiftsApi.start(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useSubmitHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubmitHandoverRequest }) =>
      shiftsApi.handover(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shiftsApi.close(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}
