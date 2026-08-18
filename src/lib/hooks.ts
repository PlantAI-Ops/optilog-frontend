import { useQuery } from "@tanstack/react-query";
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
}

export interface IncidentRow {
  id: string;
  ref: string;
  title: string;
  line_id: string;
  line_name: string;
  duration_minutes: number;
  status: string;
  owner: string;
  due_date: string;
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

export function useEvents(plantId: string | undefined, date: string, limit?: number) {
  const params = limit ? `?date=${date}&limit=${limit}` : `?date=${date}`;
  return useQuery({
    queryKey: ["dashboard", plantId, "events", date, limit],
    queryFn: () => api.get<EventRow[]>(`/plants/${plantId}/events${params}`),
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
