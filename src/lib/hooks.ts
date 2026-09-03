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
    mutationFn: ({ eventId }: { eventId: string }) =>
      api.post<RCARow>(`/rca/events/${eventId}/rca`),
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
}

export function useCurrentShift(plantId: string | undefined) {
  return useQuery({
    queryKey: ["current-shift", plantId],
    queryFn: () => api.get<CurrentShiftResponse>(`/plants/${plantId}/shifts/current`),
    enabled: !!plantId,
    staleTime: 60_000,
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

export interface TranscribeResult {
  transcript: string;
  structured_event: {
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
  };
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
  event_type: string;
  asset_name: string;
  subsystem: string;
  observation: string;
  reported_cause: string;
  suspected_cause: string;
  verified_cause: string;
  action_taken: string;
  severity: string;
  status: string;
  duration_seconds: number | null;
  transcript: string;
  source: string;
  logged_by: string;
  recording_id: string | null;
}

export function useMyEvents(plantId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["my-events", plantId, date],
    queryFn: () => api.get<MyEvent[]>(`/plants/${plantId}/my-events?date=${date}`),
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
    queryFn: () => api.get<PlannedMaintenanceItem[]>(`/plants/${plantId}/planned-maintenance?month=${month}`),
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
