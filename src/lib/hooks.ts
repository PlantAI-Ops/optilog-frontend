import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, postFormData } from "./api";

/* -------------------------------------------------------------------------- */
/*                              response types                                */
/* -------------------------------------------------------------------------- */

export interface PlantSummary {
  achievement: number;
  produced: number;
  target: number;
  downtime: number;
  activeIssues: number;
  unresolved: number;
  quality: number;
  rcaPending: number;
  lineCount: number;
}

export interface ShiftRow {
  id: string;
  name: string;
  team_id: string;
  team_name: string;
  line_id: string;
  line_name: string;
  date: string;
  start: string;
  end: string;
  produced: number;
  target: number;
  achievement: number;
  downtime_minutes: number;
  status: string;
}

export interface TeamSummaryRow {
  team_id: string;
  team_name: string;
  supervisor: string;
  headcount: number;
  achievement: number;
  events: number;
  downtime: number;
  open: number;
}

export interface EventRow {
  id: string;
  timestamp: string;
  line_id: string;
  line_name: string;
  asset_id: string;
  asset_name: string;
  shift_id: string;
  team_id: string;
  team_name: string;
  event_type: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  source: string;
  duration_seconds: number | null;
  observation: string;
  reported_cause: string;
  verified_cause: string;
  action: string;
  source_record_id: string;
  evidence: string[];
  incident_id: string | null;
}

export interface IncidentRow {
  id: string;
  ref: string;
  title: string;
  line_id: string;
  line_name: string;
  shift_id: string;
  shift_name: string;
  date: string;
  duration_minutes: number;
  status: string;
  owner: string;
  due_date: string;
}

export interface RCARow {
  id: string;
  incident_id: string;
  problem: string;
  observed_condition: string;
  root_cause: string;
  five_why: { question: string; answer: string }[];
  corrective_action: string;
  preventive_action: string;
  timeline: { time: string; label: string; source: string }[];
  evidence: { label: string; source: string }[];
  ai_insight: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AssetRollupRow {
  asset_id: string;
  asset_name: string;
  event_count: number;
  downtime_minutes: number;
  top_categories: string[];
}

export interface Area {
  id: string;
  name: string;
  plant_id: string;
}

export interface Line {
  id: string;
  name: string;
  area_id: string;
}

export interface Asset {
  id: string;
  name: string;
  line_id: string;
}

export interface Team {
  id: string;
  name: string;
  supervisor: string;
  headcount: number;
}

/* -------------------------------------------------------------------------- */
/*                                   hooks                                    */
/* -------------------------------------------------------------------------- */

const STALE_TIME = 30_000;

export interface Plant {
  id: string;
  name: string;
  /** Optional plant vocabulary fed to speech recognition (older backends omit it). */
  industry?: string;
  key_terms?: string[];
  language_notes?: string;
}

export function usePlantSummary(plantId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["dashboard", plantId, "summary", date],
    queryFn: () => api.get<PlantSummary>(`/plants/${plantId}/summary?date=${date}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function usePlant(plantId: string | undefined) {
  return useQuery({
    queryKey: ["plant", plantId],
    queryFn: () => api.get<Plant>(`/assets/plants/${plantId}`),
    enabled: !!plantId,
    staleTime: 300_000,
  });
}

export function useShifts(plantId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["dashboard", plantId, "shifts", date],
    queryFn: () => api.get<ShiftRow[]>(`/plants/${plantId}/shifts?date=${date}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useTeamsSummary(plantId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["dashboard", plantId, "teams-summary", date],
    queryFn: () => api.get<TeamSummaryRow[]>(`/plants/${plantId}/teams/summary?date=${date}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useEvents(
  plantId: string | undefined,
  date: string,
  opts?: { limit?: number; type?: string; source?: string },
) {
  const params = new URLSearchParams({ date });
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  if (opts?.source && opts.source !== "all") params.set("source", opts.source);
  return useQuery({
    queryKey: ["dashboard", plantId, "events", date, opts?.limit, opts?.type, opts?.source],
    queryFn: () => api.get<EventRow[]>(`/plants/${plantId}/events?${params.toString()}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useIncidents(plantId: string | undefined, status?: string) {
  const params = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["dashboard", plantId, "incidents", status],
    queryFn: () => api.get<IncidentRow[]>(`/plants/${plantId}/incidents${params}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useCreateRCAFromEvent() {
  const qc = useQueryClient();
  return useMutation({
    // `RCACreate` has all-defaulted fields but FastAPI still requires the body
    // object to be present — send `{}` explicitly (bare POST 422s).
    mutationFn: ({ eventId }: { eventId: string }) =>
      api.post<RCARow>(`/rca/events/${eventId}/rca`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "incidents"] });
    },
  });
}

export function useIncidentEvents(plantId: string | undefined, incidentId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "incident-events", incidentId],
    queryFn: () => api.get<EventRow[]>(`/plants/${plantId}/incidents/${incidentId}/events`),
    enabled: !!plantId && !!incidentId,
    staleTime: STALE_TIME,
  });
}

export function useIncidentRCA(incidentId: string | undefined) {
  return useQuery({
    queryKey: ["rca", incidentId],
    queryFn: () => api.get<RCARow>(`/rca/incidents/${incidentId}/rca`),
    enabled: !!incidentId,
    staleTime: STALE_TIME,
  });
}

export function useCreateRCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, data }: { incidentId: string; data: Partial<RCARow> }) =>
      api.post<RCARow>(`/rca/incidents/${incidentId}/rca`, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["rca", vars.incidentId] });
    },
  });
}

export function useUpdateRCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rcaId, data }: { rcaId: string; data: Partial<RCARow> }) =>
      api.patch<RCARow>(`/rca/${rcaId}`, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["rca", vars.rcaId] });
    },
  });
}

export function useApproveRCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rcaId: string) => api.post<RCARow>(`/rca/${rcaId}/approve`),
    onSuccess: (_res, rcaId) => {
      qc.invalidateQueries({ queryKey: ["rca", rcaId] });
    },
  });
}

export function useAssetRollup(plantId: string | undefined, days?: number) {
  const params = days ? `?days=${days}` : "";
  return useQuery({
    queryKey: ["dashboard", plantId, "assets-rollup", days],
    queryFn: () => api.get<AssetRollupRow[]>(`/plants/${plantId}/assets/rollup${params}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useAreas(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "areas"],
    queryFn: () => api.get<Area[]>(`/plants/${plantId}/areas`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useLines(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "lines"],
    queryFn: () => api.get<Line[]>(`/plants/${plantId}/lines`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export interface AreaLineGroup {
  area: Area;
  lines: Line[];
}

/** Lines grouped by their area. The plant-level GET /plants/{id}/lines omits
 * area_id (see LAYOUT_SPEC A8), so this uses the area-nested
 * GET /assets/areas/{id}/lines per area, fetched in parallel. */
export function usePlantLinesByArea(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "lines-by-area"],
    queryFn: async () => {
      const areas = await api.get<Area[]>(`/plants/${plantId}/areas`);
      const groups = await Promise.all(
        areas.map(async (area) => ({
          area,
          lines: await api.get<Line[]>(`/assets/areas/${area.id}/lines`),
        })),
      );
      return groups as AreaLineGroup[];
    },
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useAssets(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "assets"],
    queryFn: () => api.get<Asset[]>(`/plants/${plantId}/assets`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function useTeams(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "teams"],
    queryFn: () => api.get<Team[]>(`/plants/${plantId}/teams`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

/* -------------------------------------------------------------------------- */
/*                   plant-wide "current shift" + team detail                 */
/* -------------------------------------------------------------------------- */

export interface NowTeam {
  id: string;
  name: string;
  supervisor: { id: string; name: string; role: string } | null;
  member_count: number;
}

export interface CurrentShift {
  shift_type: string;
  start_hour: number;
  end_hour: number;
  /** ISO timestamps (UTC) of the active window. */
  start: string;
  end: string;
  date: string;
  /** The single team working this shift (rotation-resolved), if any. */
  team: NowTeam | null;
  source: "rotation" | "pattern" | string;
}

export interface ShiftsNowResponse {
  /** null when no shift-pattern window matches the current hour. */
  current_shift: CurrentShift | null;
}

/**
 * Plant-wide "what is running right now" — the active shift window plus the
 * rotation-resolved team working it (backend: single-team model). Read-only
 * and side-effect free (unlike the mobile /shifts/current). Polls every 60s;
 * `retry: false` so a missing endpoint degrades to hidden UI.
 */
export function useShiftsNow(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "shifts-now"],
    queryFn: () => api.get<ShiftsNowResponse>(`/plants/${plantId}/shifts/now`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
    refetchInterval: 60_000,
    retry: false,
  });
}

/* -------------------------------------------------------------------------- */
/*                         shift pattern (7-day schedule)                     */
/* -------------------------------------------------------------------------- */

export interface PatternDay {
  date: string;
  shift_type: "morning" | "afternoon" | "night" | "day" | "off" | null;
  /** "HH:MM" local plant time; null when off/undetermined. */
  start: string | null;
  end: string | null;
  /** Materialized shift document, when one exists for this slot. */
  shift_id: string | null;
  status: string | null;
  /** Per-day override applied over the computed pattern, when one exists. */
  override_id?: string | null;
}

export interface PatternTeam {
  /** Real team id, or "track:{i}" for a synthetic crew track (no teams yet). */
  team_id: string;
  team_name: string;
  supervisor_name: string | null;
  shift_config: Record<string, unknown> | null;
  /** "team" for real teams, "track" for generated crew rows. Absent = team. */
  kind?: "team" | "track";
  days: PatternDay[];
}

export interface ShiftsPatternResponse {
  from: string;
  days: number;
  timezone: string;
  teams: PatternTeam[];
}

/**
 * Computed multi-day shift pattern per team (GET /plants/{id}/shifts/pattern).
 * Strictly read-only server-side; `retry: false` so the Schedule page degrades
 * to its empty state until the backend endpoint ships.
 */
export function useShiftsPattern(plantId: string | undefined, from: string, days: number) {
  return useQuery({
    queryKey: ["dashboard", plantId, "shifts-pattern", from, days],
    queryFn: () =>
      api.get<ShiftsPatternResponse>(`/plants/${plantId}/shifts/pattern?from=${from}&days=${days}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
    retry: false,
  });
}

/* -------------------------------------------------------------------------- */
/*                    shift pattern CRUD + overrides + rotation                */
/* -------------------------------------------------------------------------- */

export interface ShiftPattern {
  id: string;
  plant_id: string;
  line_id: string | null;
  shift_type: string;
  start_hour: number;
  end_hour: number;
  /** 0 = Monday … 6 = Sunday. */
  days_of_week: number[];
  active: boolean;
}

export interface RotationConfig {
  id: string;
  plant_id: string;
  team_order: string[];
  pattern: string;
  day_offset: number;
}

export interface ShiftOverride {
  id: string;
  plant_id: string;
  row_key: string;
  date: string;
  shift_type: string;
  start_hour: number | null;
  end_hour: number | null;
}

/** GET /shift-patterns?plant_id= — the plant's configured shift windows. */
export function useShiftPatterns(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "shift-patterns"],
    queryFn: async () => {
      const response = await api.get<ShiftPattern[] | { items: ShiftPattern[] }>(
        `/shift-patterns?plant_id=${plantId}`,
      );
      return Array.isArray(response) ? response : (response.items ?? []);
    },
    enabled: !!plantId,
    staleTime: STALE_TIME,
    retry: false,
  });
}

/** GET /plants/{id}/rotation-config — 404s (error state) when unconfigured. */
export function useRotationConfig(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "rotation-config"],
    queryFn: () => api.get<RotationConfig>(`/plants/${plantId}/rotation-config`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
    retry: false,
  });
}

function useScheduleInvalidation(plantId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    if (!plantId) return;
    qc.invalidateQueries({ queryKey: ["dashboard", plantId, "shifts-pattern"] });
    qc.invalidateQueries({ queryKey: ["dashboard", plantId, "shift-patterns"] });
    qc.invalidateQueries({ queryKey: ["dashboard", plantId, "rotation-config"] });
    qc.invalidateQueries({ queryKey: ["dashboard", plantId, "shifts-now"] });
    qc.invalidateQueries({ queryKey: ["current-shift", plantId] });
  };
}

/** POST/PATCH/DELETE /shift-patterns — edits the plant's shift windows. */
export function useShiftPatternMutations(plantId: string | undefined) {
  const invalidate = useScheduleInvalidation(plantId);
  const create = useMutation({
    mutationFn: (data: {
      shift_type: string;
      start_hour: number;
      end_hour: number;
      days_of_week: number[];
      line_id?: string | null;
    }) => api.post<ShiftPattern>("/shift-patterns", { plant_id: plantId, ...data }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      shift_type?: string;
      start_hour?: number;
      end_hour?: number;
      days_of_week?: number[];
      active?: boolean;
    }) => api.patch<ShiftPattern>(`/shift-patterns/${id}`, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/shift-patterns/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

/** PATCH /plants/{id}/rotation-config — change cycle (2-2-2-2/3-3-3-3) or phase. */
export function useUpdateRotationConfig(plantId: string | undefined) {
  const invalidate = useScheduleInvalidation(plantId);
  return useMutation({
    mutationFn: (data: { pattern?: "2-2-2-2" | "3-3-3-3"; day_offset?: number }) =>
      api.patch<RotationConfig>(`/plants/${plantId}/rotation-config`, data),
    onSuccess: invalidate,
  });
}

/** Upsert (POST) + delete per-day cell overrides on the schedule grid. */
export function useShiftOverrideMutations(plantId: string | undefined) {
  const invalidate = useScheduleInvalidation(plantId);
  const upsert = useMutation({
    mutationFn: (data: {
      row_key: string;
      date: string;
      shift_type: string;
      start_hour?: number | null;
      end_hour?: number | null;
    }) => api.post<ShiftOverride>("/shifts/overrides", { plant_id: plantId, ...data }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (overrideId: string) => api.del<void>(`/shifts/overrides/${overrideId}`),
    onSuccess: invalidate,
  });
  return { upsert, remove };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export interface TeamDetail {
  id: string;
  name: string;
  plant_id?: string;
  tenant_id?: string;
  supervisor_id?: string | null;
  supervisor_name?: string | null;
  member_ids?: string[];
  /** Resolved member objects — present once the backend ships enrichment. */
  members?: TeamMember[];
  shift_config?: Record<string, unknown>;
  active?: boolean;
  /** Lines this team is placed on. Absent/empty = unplaced (tray). Needs the
   * backend LAYOUT_SPEC to persist; optional so an old backend degrades cleanly. */
  assigned_line_ids?: string[];
  /** Board ordering within a line column. */
  sort_order?: number;
}

/** Full team documents (member_ids/members) as opposed to useTeams' summaries. */
export function usePlantTeamsDetail(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "teams-detail"],
    queryFn: async () => {
      const response = await api.get<any>(`/teams?plant_id=${plantId}`);
      return (response.items ?? response) as TeamDetail[];
    },
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  /** Plants this user is assigned to. Optional so an older backend that omits
   *  it degrades to showing everyone (plant filtering skips absent fields). */
  plant_ids?: string[];
}

/** Who the Layout board and member pickers may offer for THIS plant: people
 *  already assigned to it, plus tenant users with no plant yet. Users scoped
 *  to other plants stay in the tenant but off the board. A missing plant_ids
 *  field (older backend) keeps the user visible so the pool never empties. */
export function inPlantScope(u: DirectoryUser, plantId: string | undefined): boolean {
  if (u.plant_ids === undefined || u.plant_ids.length === 0) return true;
  return !!plantId && u.plant_ids.includes(plantId);
}

/** Tenant user directory for team-member pickers. GET /users requires
 * supervisor+ on desktop — only enable for callers that can fetch it. */
export function useUserDirectory(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["users", "directory", tenantId],
    queryFn: async () => {
      const response = await api.get<any>("/users?page_size=200");
      return (response.items ?? []) as DirectoryUser[];
    },
    enabled: !!tenantId && enabled,
    staleTime: STALE_TIME,
  });
}

/** Full-replace team membership (POST /teams/{id}/members). Enforces
 * one-team-per-user server-side by pulling members from sibling teams. */
export function useSetTeamMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberIds }: { teamId: string; memberIds: string[] }) =>
      api.post<TeamDetail>(`/teams/${teamId}/members`, { member_ids: memberIds }),
    onMutate: async ({ teamId, memberIds }) => {
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const snapshots = qc
        .getQueriesData({ queryKey: ["dashboard"] })
        .filter(([key]) => Array.isArray(key) && key[2] === "teams-detail");
      snapshots.forEach(([key]) => {
        qc.setQueryData(key, (old: TeamDetail[] | undefined) =>
          Array.isArray(old)
            ? old.map((t) => {
                if (t.id === teamId) return { ...t, member_ids: memberIds };
                const ids = t.member_ids ?? [];
                return ids.some((id) => memberIds.includes(id))
                  ? { ...t, member_ids: ids.filter((id) => !memberIds.includes(id)) }
                  : t;
              })
            : old,
        );
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["users", "directory"] });
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

/** Board placement/ordering (PATCH /teams/{id}). `assigned_line_ids: []`
 * unplaces a team; omitted keys stay unchanged (backend uses exclude_unset).
 * Optimistically patches teams-detail queries, rolling back on error. */
export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      patch,
    }: {
      teamId: string;
      patch: { assigned_line_ids?: string[]; sort_order?: number; name?: string };
    }) => api.patch<TeamDetail>(`/teams/${teamId}`, patch),
    onMutate: async ({ teamId, patch }) => {
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const snapshots = qc
        .getQueriesData({ queryKey: ["dashboard"] })
        .filter(([key]) => Array.isArray(key) && key[2] === "teams-detail");
      snapshots.forEach(([key]) => {
        qc.setQueryData(key, (old: TeamDetail[] | undefined) =>
          Array.isArray(old) ? old.map((t) => (t.id === teamId ? { ...t, ...patch } : t)) : old,
        );
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Create a team on the Layout board (POST /teams, supervisor+ desktop). */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plantId, name }: { plantId: string; name: string }) =>
      api.post<TeamDetail>("/teams", { plant_id: plantId, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useShiftEvents(plantId: string | undefined, shiftId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "shift-events", shiftId],
    queryFn: () => api.get<EventRow[]>(`/plants/${plantId}/shifts/${shiftId}/events`),
    enabled: !!plantId && !!shiftId,
    staleTime: STALE_TIME,
  });
}

/* -------------------------------------------------------------------------- */
/*                              connectors page                               */
/* -------------------------------------------------------------------------- */

export interface ConnectorRow {
  id: string;
  name: string;
  system: string;
  kind: string;
  direction: string;
  health: string;
  endpoint: string;
  last_sync: string;
  records_24h: number;
  mapped_entities: string[];
  mapping: { external: string; canonical: string }[];
}

export function usePlantConnectors(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "connectors"],
    queryFn: () => api.get<ConnectorRow[]>(`/plants/${plantId}/connectors`),
    enabled: !!plantId,
    staleTime: 300_000,
  });
}

/* -------------------------------------------------------------------------- */
/*                            mobile shift endpoints                          */
/* -------------------------------------------------------------------------- */

export type ShiftType = "morning" | "afternoon" | "night" | "pending";
export type ShiftStatus = "scheduled" | "active" | "handed_over" | "closed" | "pending";

export interface CurrentShiftResponse {
  current_shift: {
    shift_id: string;
    shift_type: ShiftType;
    name: string;
    start: number;
    end: number;
    date: string;
    status: ShiftStatus;
    team_id: string;
    team_name: string;
    line_id: string;
    line_name: string;
  };
  previous_shift: {
    shift_id: string;
    shift_type: string;
    name: string;
    date: string;
  } | null;
  lines: { id: string; name: string }[];
  /** On-shift gate (ON_SHIFT_GATE_SPEC): this user's team covers the window
   *  now. Absent on older backends -> treated as "no gate" (fail open). */
  on_shift?: boolean;
  /** Team's next scheduled shift while off-shift (null when none). */
  next_shift?: {
    shift_id: string;
    shift_type: string;
    name: string;
    start: number | null;
    end: number | null;
    date: string;
    status: string;
  } | null;
  /** Teams the rotation/docs put on shift now (every team when the plant
   *  has no rotation config). */
  teams_on_shift?: { id: string; name: string; supervisor_id: string | null }[];
}

export function useCurrentShift(plantId: string | undefined) {
  return useQuery({
    queryKey: ["current-shift", plantId],
    queryFn: () => api.get<CurrentShiftResponse>(`/plants/${plantId}/shifts/current`),
    enabled: !!plantId,
    staleTime: 60_000,
  });
}

/* -------------------------------------------------------------------------- */
/*                     off-shift approval (ON_SHIFT_GATE_SPEC)                 */
/* -------------------------------------------------------------------------- */

export type LoggingApprovalStatus = "pending" | "approved" | "denied" | "expired" | "used";

export interface LoggingApproval {
  id: string;
  plant_id: string;
  operator_id: string;
  reason: string | null;
  status: LoggingApprovalStatus;
  requested_at: string;
  expires_at: string;
  approver_id: string | null;
  approved_at?: string | null;
  /* list (inbox) enrichments */
  operator_name?: string;
  approver_name?: string | null;
}

/**
 * The caller's latest request (null = never asked). Polls every 4s while
 * pending so the operator's start screen unlocks the moment a supervisor
 * approves from their own device.
 */
export function useMyLoggingApproval(plantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["logging-approval", "mine", plantId],
    queryFn: () => api.get<LoggingApproval | null>(`/plants/${plantId}/logging-approvals/mine`),
    enabled: !!plantId && enabled,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 4_000 : false),
  });
}

/** Supervisor inbox: requests waiting for a decision on this plant. */
export function usePendingLoggingApprovals(plantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["logging-approval", "pending", plantId],
    queryFn: () => api.get<LoggingApproval[]>(`/plants/${plantId}/logging-approvals/pending`),
    enabled: !!plantId && enabled,
    staleTime: 0,
    refetchInterval: 8_000,
  });
}

function useApprovalInvalidation() {
  const queryClient = useQueryClient();
  // Prefix key: matches both ["logging-approval","mine",...] and
  // ["logging-approval","pending",...].
  return () => queryClient.invalidateQueries({ queryKey: ["logging-approval"] });
}

/** Off-shift operator: ask the on-shift supervisor to unlock logging. */
export function useCreateLoggingApproval(plantId: string | undefined) {
  const invalidate = useApprovalInvalidation();
  return useMutation({
    mutationFn: (reason: string) =>
      api.post<LoggingApproval>(`/plants/${plantId}/logging-approvals`, { reason }),
    onSuccess: invalidate,
  });
}

/** Supervisor: approve a request (unlocks the operator within ~4s). */
export function useApproveLoggingApproval(plantId: string | undefined) {
  const invalidate = useApprovalInvalidation();
  return useMutation({
    mutationFn: (approvalId: string) =>
      api.post<LoggingApproval>(`/logging-approvals/${approvalId}/approve`),
    onSuccess: invalidate,
  });
}

/** Supervisor: decline a request. */
export function useDenyLoggingApproval(plantId: string | undefined) {
  const invalidate = useApprovalInvalidation();
  return useMutation({
    mutationFn: (approvalId: string) =>
      api.post<LoggingApproval>(`/logging-approvals/${approvalId}/deny`),
    onSuccess: invalidate,
  });
}

export interface CarriedOverIssue {
  id: string;
  type: string;
  title: string;
  severity: string;
  status: string;
  line_name: string;
}

export interface CarriedOverResponse {
  issues: string[];
}

export function useCarriedOver(
  plantId: string | undefined,
  shiftType: string | undefined,
  date: string,
) {
  return useQuery({
    queryKey: ["carried-over", plantId, shiftType, date],
    queryFn: () =>
      api.get<CarriedOverResponse>(
        `/plants/${plantId}/shifts/carried-over?shift_id=${shiftType}&date=${date}`,
      ),
    enabled: !!plantId && !!shiftType,
    staleTime: 60_000,
  });
}

export function useEventAudio(shiftId: string | undefined, eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-audio", shiftId, eventId],
    queryFn: () =>
      api.get<{ audio_url: string | null }>(`/shifts/${shiftId}/events/${eventId}/audio`),
    enabled: !!shiftId && !!eventId,
    staleTime: 3_600_000,
  });
}

/* -------------------------------------------------------------------------- */
/*                              voice recordings                               */
/* -------------------------------------------------------------------------- */

export interface RecordingInfo {
  id: string;
  /** pending → uploaded/transcribed → completed, or failed. */
  status: string;
  transcript: string | null;
  /** ASR output kept once a human correction replaces it. */
  transcript_original?: string | null;
  error?: string | null;
  duration?: number | null;
  created_at?: string;
}

export function useRecording(recordingId: string | undefined) {
  return useQuery({
    queryKey: ["recording", recordingId],
    queryFn: () => api.get<RecordingInfo>(`/recordings/${recordingId}`),
    enabled: !!recordingId,
    staleTime: 60_000,
  });
}

/**
 * Replace a recording's transcript with the operator's correction; the ASR
 * original survives as `transcript_original` and the diff becomes vocabulary.
 */
export function useFixTranscript(recordingId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transcript: string) =>
      api.patch<RecordingInfo>(`/recordings/${recordingId}/transcript`, { transcript }),
    onSuccess: (updated) => {
      qc.setQueryData(["recording", recordingId], updated);
      qc.invalidateQueries({ queryKey: ["recording", recordingId] });
    },
  });
}

/**
 * A suspected mis-transcription: ASR heard `heard` but thinks `corrected` is
 * right. Tap the chip on the confirm screen to apply it to the transcript.
 */
export interface CorrectionSuggestion {
  heard: string;
  corrected: string;
  confidence?: number;
}

export interface StructuredEvent {
  event_type?: string;
  observation?: string;
  reported_cause?: string;
  suspected_cause?: string;
  verified_cause?: string;
  action_taken?: string;
  severity?: string;
  status?: string;
  asset_name?: string;
  subsystem?: string;
  duration_seconds?: number;
  correction_suggestions?: CorrectionSuggestion[];
}

export interface TranscribeResult {
  transcript: string;
  /** The model may return no structured event at all — guard before use. */
  structured_event: StructuredEvent | null;
}

/* -------------------------------------------------------------------------- */
/*                          shifts-month (calendar)                            */
/* -------------------------------------------------------------------------- */

export interface ShiftEventSummary {
  id: string;
  observation: string;
  event_type: string;
  severity: string;
  status: string;
  timestamp: string;
}

export interface ShiftMonthShift {
  shift_id: string;
  shift_type: string;
  team_name: string;
  event_count: number;
  events: ShiftEventSummary[];
}

export interface ShiftDaySummary {
  date: string;
  shifts: ShiftMonthShift[];
}

export function useShiftsMonth(plantId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["shifts-month", plantId, month],
    queryFn: () => api.get<ShiftDaySummary[]>(`/plants/${plantId}/shifts/month?month=${month}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

/* -------------------------------------------------------------------------- */
/*                          my-events (shift-log)                             */
/* -------------------------------------------------------------------------- */

export interface MyEvent {
  id: string;
  timestamp: string;
  line_id: string;
  line_name: string;
  asset_id: string;
  asset_name: string;
  shift_id: string;
  team_id: string;
  team_name: string;
  event_type: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  source: string;
  duration_seconds: number;
  observation: string;
  reported_cause: string;
  suspected_cause: string;
  verified_cause: string;
  action_taken: string;
  action: string;
  source_record_id: string;
  evidence: any[];
  incident_id: string;
  /** Owner of the event (absent on older backends -> no owner-based rights). */
  operator_id?: string;
  operator_name?: string;
}

export function useMyEvents(plantId: string | undefined, date: string, shiftId?: string) {
  return useQuery({
    queryKey: ["plant", plantId, "my-events", date, shiftId],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      if (shiftId) params.set("shift_id", shiftId);
      return api.get<MyEvent[]>(`/plants/${plantId}/my-events?${params.toString()}`);
    },
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

/* -------------------------------------------------------------------------- */
/*                       planned maintenance                                  */
/* -------------------------------------------------------------------------- */

export interface PlannedMaintenanceItem {
  event_id: string;
  shift_id: string;
  planned_date: string;
  maintenance_notes: string;
  assigned_team: string;
  event_type: string;
  observation: string;
  reported_cause: string;
  suspected_cause: string;
  severity: string;
  asset_name: string;
  line_name: string;
  shift_name: string;
  team_name: string;
  logged_by: string;
  created_at: string;
}

export function usePlannedMaintenance(plantId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["planned-maintenance", plantId, month],
    queryFn: () =>
      api.get<PlannedMaintenanceItem[]>(`/plants/${plantId}/planned-maintenance?month=${month}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export function usePlanMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      eventId,
      plantId,
      plannedDate,
      notes,
      assignedTeam,
    }: {
      shiftId: string;
      eventId: string;
      plantId: string;
      plannedDate: string;
      notes: string;
      assignedTeam: string;
    }) =>
      api.post(`/shifts/${shiftId}/events/${eventId}/plan-maintenance`, {
        planned_date: plannedDate,
        notes,
        assigned_team: assignedTeam,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["planned-maintenance", variables.plantId] });
    },
  });
}

export function useUpdatePlannedMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      plantId,
      eventId,
      patch,
    }: {
      plantId: string;
      eventId: string;
      patch: { planned_date?: string; maintenance_notes?: string; status?: string };
    }) => api.patch(`/plants/${plantId}/planned-maintenance/${eventId}`, patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["planned-maintenance", variables.plantId] });
    },
  });
}

export function useCompletePlannedMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plantId, eventId }: { plantId: string; eventId: string }) =>
      api.post(`/plants/${plantId}/planned-maintenance/${eventId}/complete`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["planned-maintenance", variables.plantId] });
    },
  });
}

export async function transcribeAudio(
  audioBlob: Blob,
  plantId?: string,
  shiftId?: string,
  browserTranscript?: string,
): Promise<TranscribeResult> {
  const formData = new FormData();
  const ext = audioBlob.type.includes("ogg") ? "ogg" : "webm";
  formData.append("file", audioBlob, `recording.${ext}`);
  if (plantId) formData.append("plant_id", plantId);
  if (shiftId) formData.append("shift_id", shiftId);
  if (browserTranscript) formData.append("browser_transcript", browserTranscript);
  return postFormData<TranscribeResult>("/recordings/speech-to-text", formData);
}

/* -------------------------------------------------------------------------- */
/*                     shift detail + report approval                          */
/* -------------------------------------------------------------------------- */

export interface ShiftDetail {
  id: string;
  shift_type: string;
  status: string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  team_name?: string;
  /** Present once a supervisor approved the end-of-shift report. */
  report_approved_at?: string | null;
  report_approved_by?: string | null;
  handover?: { notes?: string; open_issues?: string[] } | string | null;
  summary?: { event_count?: number; open_issues?: number; downtime_seconds?: number };
}

/** GET /shifts/{id} — single shift (report approval state lives here). */
export function useShift(shiftId: string | undefined) {
  return useQuery({
    queryKey: ["shift", shiftId],
    queryFn: () => api.get<ShiftDetail>(`/shifts/${shiftId}`),
    enabled: !!shiftId,
    staleTime: 0,
  });
}

export function useApproveShiftReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, approve }: { shiftId: string; approve: boolean }) =>
      api.post(`/shifts/${shiftId}/report/${approve ? "approve" : "unapprove"}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["shift", variables.shiftId] });
      qc.invalidateQueries({ queryKey: ["report-approvals"] });
    },
  });
}

/** Shifts that ended and still need a supervisor to approve the report. */
export interface ReportApprovalRow {
  id: string;
  shift_type: string;
  date: string;
  team_name: string;
  status: string;
  actual_end: string | null;
  event_count: number;
  open_issues: number;
  handover_notes: string;
  /** Set once a supervisor approved the report (null = still pending). */
  report_approved_at?: string | null;
  report_approved_by?: string | null;
}

export function useReportApprovals(plantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["report-approvals", plantId],
    queryFn: () => api.get<ReportApprovalRow[]>(`/plants/${plantId}/shifts/report-approvals`),
    enabled: !!plantId && enabled,
    staleTime: 0,
    refetchInterval: 15_000,
  });
}

/* -------------------------------------------------------------------------- */
/*                        event review actions (Approvals)                     */
/* -------------------------------------------------------------------------- */

/** POST /events/{id}/confirm — draft -> confirmed (409 otherwise). */
export function useConfirmEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId }: { eventId: string }) => api.post(`/events/${eventId}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", "events"] }),
  });
}

/** POST /events/{id}/resolve — marks the issue handled. */
export function useResolveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId }: { eventId: string }) => api.post(`/events/${eventId}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "events"] });
      qc.invalidateQueries({ queryKey: ["planned-maintenance"] });
    },
  });
}

export interface ActionRow {
  id: string;
  event_id: string | null;
  incident_id: string | null;
  type: string;
  description: string;
  status: string;
  due_date: string | null;
}

/** GET /actions?type=… — used to know which events were already pushed. */
export function useActionsByType(plantId: string | undefined, type: string, enabled = true) {
  return useQuery({
    queryKey: ["actions", plantId, type],
    queryFn: () =>
      api.get<{ items: ActionRow[] } | ActionRow[]>(
        `/actions?type=${encodeURIComponent(type)}&page_size=200`,
      ),
    enabled,
    staleTime: 30_000,
  });
}

/* -------------------------------------------------------------------------- */
/*                          ai vocabulary lessons                              */
/* -------------------------------------------------------------------------- */

export type AILessonStatus =
  "suggested" | "auto_verified" | "verified" | "rejected" | "ineffective";

export interface AILesson {
  id: string;
  plant_id?: string | null;
  scope?: string;
  kind: string;
  trigger?: { text?: string } | null;
  correction: string;
  confidence?: number | null;
  status: AILessonStatus | string;
  source: string;
  hits?: number;
  recurrence_count?: number;
  last_seen_at?: string | null;
  verified_at?: string | null;
}

export interface AILessonPage {
  items: AILesson[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** GET /plants/{id}/ai-lessons?status=… (supervisor+, desktop). */
export function useAILessonsByStatus(
  plantId: string | undefined,
  status: AILessonStatus,
  enabled = true,
) {
  return useQuery({
    queryKey: ["ai-lessons", plantId, status],
    queryFn: () =>
      api.get<AILessonPage>(`/plants/${plantId}/ai-lessons?status=${status}&page_size=100`),
    enabled: !!plantId && enabled,
    staleTime: 30_000,
  });
}

/** The review queue: lessons that entered the prompts, or fell out of them. */
export function useLessonsToReview(plantId: string | undefined, enabled = true) {
  const suggested = useAILessonsByStatus(plantId, "suggested", enabled);
  const ineffective = useAILessonsByStatus(plantId, "ineffective", enabled);
  return {
    items: [...(suggested.data?.items ?? []), ...(ineffective.data?.items ?? [])],
    total: (suggested.data?.total ?? 0) + (ineffective.data?.total ?? 0),
    isLoading: suggested.isLoading || ineffective.isLoading,
  };
}

/** POST /plants/{id}/ai-lessons — manual term/correction (applies immediately). */
export function useAddAILesson(plantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { kind: string; trigger?: string; correction: string }) =>
      api.post<AILesson>(`/plants/${plantId}/ai-lessons`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-lessons", plantId] }),
  });
}

/** POST /ai-lessons/{id}/verify — it immediately enters STT/LLM prompts. */
export function useVerifyAILesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api.post<AILesson>(`/ai-lessons/${lessonId}/verify`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-lessons"] }),
  });
}

/** POST /ai-lessons/{id}/reject — terminal; only future evidence reopens it. */
export function useRejectAILesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api.post<AILesson>(`/ai-lessons/${lessonId}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-lessons"] }),
  });
}
