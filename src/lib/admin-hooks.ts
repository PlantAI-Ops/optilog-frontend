import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Tenant, TenantConfig, AdminPlant, Invitation, Role, SeedPreset } from "./shift-log";

/* -------------------------------------------------------------------------- */
/*                              response types                                */
/* -------------------------------------------------------------------------- */

interface SeedResponse {
  plant_id: string;
  preset: string;
  created: Record<string, number>;
}

interface InvitationAcceptResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

/* -------------------------------------------------------------------------- */
/*                              tenant hooks                                  */
/* -------------------------------------------------------------------------- */

const STALE_TIME = 30_000;

export function useTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get<Tenant[]>("/admin/tenants"),
    staleTime: STALE_TIME,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      slug: string;
      contact_email: string;
      status?: string;
      trial_days?: number;
      max_users?: number;
      max_plants?: number;
      config?: Partial<TenantConfig>;
    }) => api.post<Tenant>("/admin/tenants", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () => api.get<Tenant>(`/admin/tenants/${tenantId}`),
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });
}

export function useUpdateTenant(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      contact_email?: string;
      status?: string;
      trial_days?: number;
      max_users?: number;
      max_plants?: number;
      config?: Partial<TenantConfig>;
    }) => api.patch<Tenant>(`/admin/tenants/${tenantId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId] });
    },
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => api.del(`/admin/tenants/${tenantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                               plant hooks                                  */
/* -------------------------------------------------------------------------- */

export function useTenantPlants(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "plants"],
    queryFn: () => api.get<AdminPlant[]>(`/admin/tenants/${tenantId}/plants`),
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });
}

export function useCreatePlant(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; location?: string; timezone?: string }) =>
      api.post<AdminPlant>(`/admin/tenants/${tenantId}/plants`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] });
    },
  });
}

export function useUpdatePlant(plantId: string, tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; location?: string; timezone?: string }) =>
      api.patch<AdminPlant>(`/admin/plants/${plantId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] });
    },
  });
}

export function useDeletePlant(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plantId: string) => api.del(`/admin/plants/${plantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                seed hooks                                  */
/* -------------------------------------------------------------------------- */

export function useSeedPlant(plantId: string, tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { preset: SeedPreset; include_demo_data?: boolean }) =>
      api.post<SeedResponse>(`/admin/plants/${plantId}/seed`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                           invitation hooks                                 */
/* -------------------------------------------------------------------------- */

export function useTenantInvitations(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "invitations"],
    queryFn: () => api.get<Invitation[]>(`/admin/tenants/${tenantId}/invitations`),
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });
}

export function useInviteUser(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: Role; plant_ids?: string[] }) =>
      api.post<Invitation>(`/admin/tenants/${tenantId}/invite`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "invitations"] });
    },
  });
}

export function useRevokeInvitation(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => api.del(`/admin/invitations/${invitationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "invitations"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                        public invitation hooks                              */
/* -------------------------------------------------------------------------- */

export function useInvitationInfo(token: string | undefined) {
  return useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.get<Invitation>(`/admin/invitations/${token}/info`),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: ({ token, name, password }: { token: string; name: string; password: string }) =>
      api.post<InvitationAcceptResponse>(`/admin/invitations/${token}/accept`, {
        token,
        name,
        password,
      }),
  });
}
