import { api } from "@/lib/api-client";
import type {
  TeamResponse,
  CreateTeamRequest,
  UpdateTeamRequest,
  SetTeamMembersRequest,
} from "@/types/api";

export const teamsApi = {
  list(plantId: string): Promise<TeamResponse[]> {
    return api.get("/teams", { params: { plant_id: plantId } });
  },

  get(id: string): Promise<TeamResponse> {
    return api.get(`/teams/${id}`);
  },

  create(data: CreateTeamRequest): Promise<TeamResponse> {
    return api.post("/teams", data);
  },

  update(id: string, data: UpdateTeamRequest): Promise<TeamResponse> {
    return api.patch(`/teams/${id}`, data);
  },

  setMembers(id: string, data: SetTeamMembersRequest): Promise<TeamResponse> {
    return api.post(`/teams/${id}/members`, data);
  },
};
