import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Tenant, TenantConfig, AdminPlant, Invitation, Role, SeedPreset } from "./shift-log";
import type {
  AreaData,
  LineData,
  ShiftConfig,
  ShiftHours,
  TeamData,
} from "@/components/admin/PlantSetupForm";

/* -------------------------------------------------------------------------- */
/*                              response types                                */
/* -------------------------------------------------------------------------- */

interface SeedResponse {
  plant_id: string;
  preset: string;
  created: Record<string, number>;
}

interface ApplyConfigResponse {
  plant_id: string;
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

export function useTenants(enabled: boolean = true) {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: async () => {
      const response = await api.get<any>("/admin/tenants");
      return normalizeArrayResponse<Tenant>(response);
    },
    staleTime: STALE_TIME,
    enabled,
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
    queryFn: async () => {
      const response = await api.get<any>(`/admin/tenants/${tenantId}/plants`);
      return normalizeArrayResponse<AdminPlant>(response);
    },
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
/*                          setup payload serialization                       */
/* -------------------------------------------------------------------------- */

/**
 * Backend-canonical shift configs (mirrors `app.schemas.shifts.ShiftConfig`).
 * The wizard's internal `extended_rotating` shape is translated to these
 * before POST so the strict backend discriminated union accepts the payload.
 */
type BackendShiftConfig =
  | { type: "regular_day"; start_hour: number; end_hour: number; weekdays_only: boolean }
  | { type: "rotating"; pattern: "2-2-2-2" | "3-3-3-3"; hours: ShiftHours }
  | { type: "extended_day"; start_hour: number; end_hour: number }
  | { type: "night"; start_hour: number; end_hour: number };

interface WizardSetupPayload {
  areas: AreaData[];
  lines: LineData[];
  teams: TeamData[];
  globalShiftType: string;
  customShiftName: string;
  /** Plant-level shift config used to auto-generate crews when teams is empty. */
  globalShiftConfig?: ShiftConfig;
}

function toBackendShiftConfig(config: ShiftConfig, currentShift?: string): BackendShiftConfig {
  if (config.type !== "extended_rotating") return config;
  return currentShift === "night"
    ? { type: "night", start_hour: config.hours.night.start, end_hour: config.hours.night.end }
    : { type: "extended_day", start_hour: config.hours.day.start, end_hour: config.hours.day.end };
}

function toBackendSetupPayload(data: WizardSetupPayload) {
  return {
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      shift_config: toBackendShiftConfig(team.shift_config, team.current_shift),
    })),
  };
}

export function useApplyWizardConfig(plantId: string, tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WizardSetupPayload) =>
      api.post<ApplyConfigResponse>(`/admin/plants/${plantId}/setup`, toBackendSetupPayload(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                           invitation hooks                                 */
/* -------------------------------------------------------------------------- */

export function useTenantInvitations(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "invitations"],
    queryFn: async () => {
      const response = await api.get<any>(`/admin/tenants/${tenantId}/invitations`);
      return normalizeArrayResponse<Invitation>(response);
    },
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

export interface BulkFailure {
  id: string;
  error: string;
}

export interface BulkRevokeResult {
  revoked: number;
  failed: BulkFailure[];
}

export function useBulkRevokeInvitations(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitation_ids: string[]) =>
      api.post<BulkRevokeResult>("/admin/invitations/bulk-revoke", { invitation_ids }),
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

/* -------------------------------------------------------------------------- */
/*                        system admin hooks                                 */
/* -------------------------------------------------------------------------- */

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant_id: string;
  tenant_name: string;
  plant_ids: string[];
  /** plant_id -> plant_name, resolved server-side (missing ids = deleted plants) */
  plant_names?: Record<string, string>;
  /** team name the user belongs to, resolved server-side (null/absent = no team) */
  team_name?: string | null;
  active: boolean;
  created_at: string;
}

interface SystemUsersResponse {
  users: SystemUser[];
  total: number;
  page: number;
  limit: number;
}

/** Query params supported by GET /admin/users and GET /admin/tenants/{id}/users */
export interface UserListParams {
  page?: number;
  /** backend param name is page_size (max 100) */
  page_size?: number;
  tenant_id?: string;
  role?: Role;
  /** "all" disables the active filter entirely (backend must accept active=all) */
  active?: boolean | "all";
  search?: string;
}

/** Filter-only subset of UserListParams (what filter UIs emit) */
export type UserListFilters = Omit<UserListParams, "page" | "page_size">;

export function buildUserListQuery(params?: UserListParams): string {
  if (!params) return "";
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  if (params.tenant_id) query.set("tenant_id", params.tenant_id);
  if (params.role) query.set("role", params.role);
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.search) query.set("search", params.search);
  return query.toString();
}

function normalizeUsersResponse(response: any): SystemUsersResponse {
  return {
    users: response.items ?? [],
    total: response.total ?? 0,
    page: response.page ?? 1,
    limit: response.page_size ?? 20,
  };
}

export function useSystemUsers(params?: UserListParams) {
  const query = buildUserListQuery(params);
  return useQuery({
    queryKey: ["system", "users", query],
    queryFn: async () => normalizeUsersResponse(await api.get<any>(`/admin/users?${query}`)),
    staleTime: STALE_TIME,
  });
}

function normalizeStatsResponse(response: any) {
  const tenantsByStatus = response.tenants_by_status ?? response.tenantsByStatus ?? {};
  const usersByRole = response.users_by_role ?? response.usersByRole ?? {};

  return {
    total_tenants: response.total_tenants ?? response.totalTenants ?? response.tenants_count ?? 0,
    total_users: response.total_users ?? response.totalUsers ?? response.users_count ?? 0,
    total_plants: response.total_plants ?? response.totalPlants ?? response.plants_count ?? 0,
    active_tenants:
      tenantsByStatus.active ?? response.active_tenants ?? response.activeTenants ?? 0,
    trial_tenants: tenantsByStatus.trial ?? response.trial_tenants ?? response.trialTenants ?? 0,
    suspended_tenants:
      tenantsByStatus.suspended ?? response.suspended_tenants ?? response.suspendedTenants ?? 0,
    tenants_by_status: tenantsByStatus,
    users_by_role: usersByRole,
  };
}

function normalizeArrayResponse<T>(response: any): T[] {
  return response.items ?? response.data ?? response ?? [];
}

export function useSystemStats() {
  return useQuery({
    queryKey: ["system", "stats"],
    queryFn: async () => {
      const response = await api.get<any>("/admin/stats");
      return normalizeStatsResponse(response);
    },
    staleTime: STALE_TIME,
  });
}

export function useSystemUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["system", "users", userId],
    queryFn: () => api.get<SystemUser>(`/admin/users/${userId}`),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });
}

export function useCreateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      name: string;
      password: string;
      role: Role;
      tenant_id: string;
      plant_ids?: string[];
      send_invitation?: boolean;
    }) => api.post<SystemUser>("/admin/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useUpdateSystemUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      email?: string;
      role?: Role;
      tenant_id?: string;
      plant_ids?: string[];
      active?: boolean;
    }) => api.patch<SystemUser>(`/admin/users/${userId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      qc.invalidateQueries({ queryKey: ["system", "users", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useDeleteSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.del(`/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export interface BulkUpdateResult {
  updated: number;
  failed: BulkFailure[];
}

export interface BulkUserPatch {
  active?: boolean;
  role?: Role;
  plant_ids?: string[];
}

export function useBulkUpdateUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      user_ids: string[];
      patch: BulkUserPatch;
      plant_mode?: "replace" | "add" | "remove";
    }) => api.post<BulkUpdateResult>("/admin/users/bulk-update", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

/** Soft-deactivate (active=false), parity with the single DELETE /admin/users/{id}. */
export function useBulkDeleteUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_ids: string[]) =>
      api.post<BulkUpdateResult>("/admin/users/bulk-delete", { user_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useTenantUsers(tenantId: string | undefined, params?: UserListParams) {
  const query = buildUserListQuery(params);
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "users", query],
    queryFn: async () =>
      normalizeUsersResponse(await api.get<any>(`/admin/tenants/${tenantId}/users?${query}`)),
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });
}

export interface TenantStats {
  total_users: number;
  active_users: number;
  total_plants: number;
  pending_invitations: number;
  users_by_role: Record<string, number>;
}

export function useTenantStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "stats"],
    queryFn: () => api.get<TenantStats>(`/admin/tenants/${tenantId}/stats`),
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });
}
