import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionsApi } from "@/services/actions.service";
import type { CreateActionRequest, UpdateActionRequest, ListActionsParams } from "@/types/api";

export function useActions(params?: ListActionsParams) {
  return useQuery({
    queryKey: ["actions", params],
    queryFn: () => actionsApi.list(params),
  });
}

export function useAction(id: string) {
  return useQuery({
    queryKey: ["actions", id],
    queryFn: () => actionsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActionRequest) => actionsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions"] }),
  });
}

export function useUpdateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActionRequest }) =>
      actionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions"] }),
  });
}

export function useCompleteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actionsApi.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions"] }),
  });
}
