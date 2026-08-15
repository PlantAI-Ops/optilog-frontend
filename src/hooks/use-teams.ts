import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamsApi } from "@/services/teams.service";
import type { CreateTeamRequest, UpdateTeamRequest, SetTeamMembersRequest } from "@/types/api";

export function useTeams(plantId: string) {
  return useQuery({
    queryKey: ["teams", { plantId }],
    queryFn: () => teamsApi.list(plantId),
    enabled: !!plantId,
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ["teams", id],
    queryFn: () => teamsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTeamRequest) => teamsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamRequest }) =>
      teamsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useSetTeamMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SetTeamMembersRequest }) =>
      teamsApi.setMembers(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
