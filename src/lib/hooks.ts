import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

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

export function usePlantSummary(plantId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["dashboard", plantId, "summary", date],
    queryFn: () => api.get<PlantSummary>(`/plants/${plantId}/summary?date=${date}`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
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
    queryFn: () => api.get<RCARow>(`/incidents/${incidentId}/rca`),
    enabled: !!incidentId,
    staleTime: STALE_TIME,
  });
}

export function useCreateRCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, data }: { incidentId: string; data: Partial<RCARow> }) =>
      api.post<RCARow>(`/incidents/${incidentId}/rca`, data),
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

export function useShiftEvents(plantId: string | undefined, shiftId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "shift-events", shiftId],
    queryFn: () => api.get<EventRow[]>(`/plants/${plantId}/shifts/${shiftId}/events`),
    enabled: !!plantId && !!shiftId,
    staleTime: STALE_TIME,
  });
}
