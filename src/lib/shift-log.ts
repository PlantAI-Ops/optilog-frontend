import { useSyncExternalStore } from "react";
import { api, clearToken, getToken, setRefreshToken, setToken } from "./api";

/* -------------------------------------------------------------------------- */
/*                                   types                                    */
/* -------------------------------------------------------------------------- */

export type Role =
  | "operator"
  | "technician"
  | "supervisor"
  | "shift_manager"
  | "plant_manager"
  | "integration_admin"
  | "system_admin";

export type EventStatus = "resolved" | "unresolved" | "under_review";
export type SyncState = "pending" | "synced";

export interface ShiftEvent {
  id: string;
  event_type: string;
  asset: string;
  subsystem: string;
  timestamp: string;
  duration_minutes: number | null;
  observation: string;
  reported_cause: string;
  verified_cause: string;
  action_taken: string;
  status: EventStatus;
  source: "voice" | "manual";
  confidence: number;
  transcript: string;
  sync: SyncState;
  logged_by: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant_id: string;
  plant_ids: string[];
}

export interface ShiftState {
  user: User | null;
  shiftActive: boolean;
  shiftId: string | null;
  shiftName: string;
  line: string;
  startedAt: string | null;
  endedAt: string | null;
  handover: string;
  reportApproved: boolean;
  events: ShiftEvent[];
  carriedOver: string[];
  online: boolean;
  loading: boolean;
  error: string | null;
}

/* -------------------------------------------------------------------------- */
/*                              role hierarchy                                */
/* -------------------------------------------------------------------------- */

const ROLE_HIERARCHY: Record<Role, number> = {
  operator: 0,
  technician: 1,
  supervisor: 2,
  shift_manager: 3,
  plant_manager: 4,
  integration_admin: 5,
  system_admin: 6,
};

export function hasMinRole(userRole: Role, required: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}

/* -------------------------------------------------------------------------- */
/*                                  store                                     */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "shiftlog.state.v1";

const initialState: ShiftState = {
  user: null,
  shiftActive: false,
  shiftId: null,
  shiftName: "Morning",
  line: "Packaging Line 2",
  startedAt: null,
  endedAt: null,
  handover: "",
  reportApproved: false,
  events: [],
  carriedOver: [
    "Abnormal motor noise — Line 3 (unresolved)",
    "Labeller misfeed — Packaging 2 (unresolved)",
    "Quality observation SKU-204 (under review)",
  ],
  online: true,
  loading: false,
  error: null,
};

let state: ShiftState = initialState;
let hydrated = false;
let syncing = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full — keep in-memory copy */
  }
}

export function setState(patch: Partial<ShiftState> | ((s: ShiftState) => Partial<ShiftState>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  persist();
  emit();
}

function subscribe(listener: () => void) {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...initialState, ...(JSON.parse(raw) as ShiftState) };
    } catch {
      /* ignore corrupt payload */
    }
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShiftLog(): ShiftState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState,
  );
}

/* -------------------------------------------------------------------------- */
/*                                  auth                                      */
/* -------------------------------------------------------------------------- */

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function login(email: string, password: string): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const res = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });
    setToken(res.access_token);
    setRefreshToken(res.refresh_token);
    const user = await api.get<User>("/auth/me");
    setState({ user, loading: false });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Login failed";
    setState({ error: message, loading: false });
    throw e;
  }
}

export async function restoreSession(): Promise<void> {
  const token = getToken();
  if (!token) return;
  setState({ loading: true });
  try {
    const user = await api.get<User>("/auth/me");
    setState({ user, loading: false });
  } catch (e: unknown) {
    clearToken();
    setState({ user: null, loading: false });
    if (e instanceof Error && "status" in e && (e as { status: number }).status === 401) {
      throw e;
    }
  }
}

export function logout() {
  clearToken();
  setState({
    user: null,
    shiftActive: false,
    shiftId: null,
    startedAt: null,
    endedAt: null,
    events: [],
    handover: "",
    reportApproved: false,
    error: null,
  });
}

/* -------------------------------------------------------------------------- */
/*                              shift actions                                 */
/* -------------------------------------------------------------------------- */

interface StartShiftResponse {
  id: string;
  started_at: string;
}

export async function startShift(): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const res = await api.post<StartShiftResponse>("/shifts/start", {
      shift_name: state.shiftName,
      line: state.line,
    });
    setState({
      shiftActive: true,
      shiftId: res.id,
      startedAt: res.started_at,
      endedAt: null,
      reportApproved: false,
      loading: false,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to start shift";
    setState({ error: message, loading: false });
    throw e;
  }
}

export async function endShift(handover: string): Promise<void> {
  if (!state.shiftId) return;
  setState({ loading: true, error: null });
  try {
    await api.post(`/shifts/${state.shiftId}/end`, { handover });
    setState({
      shiftActive: false,
      endedAt: new Date().toISOString(),
      handover,
      loading: false,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to end shift";
    setState({ error: message, loading: false });
    throw e;
  }
}

export async function addEvent(event: ShiftEvent): Promise<void> {
  setState((s) => ({ events: [...s.events, event] }));
  if (!state.shiftId || !state.online) return;
  try {
    await api.post(`/shifts/${state.shiftId}/events`, event);
    setState((s) => ({
      events: s.events.map((e) => (e.id === event.id ? { ...e, sync: "synced" as const } : e)),
    }));
  } catch {
    /* will be retried by syncPending */
  }
}

export function updateEvent(id: string, patch: Partial<ShiftEvent>) {
  setState((s) => ({
    events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

/* -------------------------------------------------------------------------- */
/*                                  sync                                      */
/* -------------------------------------------------------------------------- */

export function setOnline(online: boolean) {
  setState({ online });
  if (online) syncPending();
}

export async function syncPending(): Promise<void> {
  if (syncing || !state.online || !state.shiftId) return;
  syncing = true;
  const pending = state.events.filter((e) => e.sync === "pending");
  for (const event of pending) {
    try {
      await api.post(`/shifts/${state.shiftId}/events`, event);
      setState((s) => ({
        events: s.events.map((e) => (e.id === event.id ? { ...e, sync: "synced" as const } : e)),
      }));
    } catch {
      /* will retry on next sync */
    }
  }
  syncing = false;
}

/* -------------------------------------------------------------------------- */
/*                                helpers                                     */
/* -------------------------------------------------------------------------- */

export function approveReport() {
  setState({ reportApproved: true });
}

export function pendingCount(s: ShiftState) {
  return s.events.filter((e) => e.sync === "pending").length;
}

export function unresolvedCount(s: ShiftState) {
  return s.events.filter((e) => e.status === "unresolved").length;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  resolved: "Resolved",
  unresolved: "Unresolved",
  under_review: "Under review",
};

/* ------------------------- simulated structuring ------------------------- */

const SAMPLES: Array<Omit<ShiftEvent, "id" | "timestamp" | "sync" | "logged_by">> = [
  {
    event_type: "Conveyor jam",
    asset: "Packaging Line 2",
    subsystem: "Infeed conveyor",
    duration_minutes: 20,
    observation: "Line stopped, product backed up at infeed.",
    reported_cause: "Operator reported a jam at the conveyor.",
    verified_cause: "Maintenance found a misaligned guide rail.",
    action_taken: "Guide rail realigned, line restarted.",
    status: "resolved",
    source: "voice",
    confidence: 0.91,
    transcript:
      "Line 2 stopped around ten fifteen. The conveyor was jammed. Maintenance came and fixed it after about twenty minutes.",
  },
  {
    event_type: "Material shortage",
    asset: "Packaging Line 2",
    subsystem: "Carton magazine",
    duration_minutes: 12,
    observation: "Cartons ran out, line idled waiting on stores.",
    reported_cause: "Stores delivery late.",
    verified_cause: "",
    action_taken: "Pallet delivered, line resumed.",
    status: "resolved",
    source: "voice",
    confidence: 0.84,
    transcript: "We ran out of cartons for about twelve minutes waiting on stores.",
  },
  {
    event_type: "Abnormal motor noise",
    asset: "Line 3",
    subsystem: "Drive motor",
    duration_minutes: null,
    observation: "Grinding noise from the drive motor at high speed.",
    reported_cause: "Possible bearing wear.",
    verified_cause: "",
    action_taken: "Logged for maintenance inspection next shift.",
    status: "unresolved",
    source: "voice",
    confidence: 0.72,
    transcript: "There's a grinding noise coming off the line three drive motor when it speeds up.",
  },
  {
    event_type: "Quality observation",
    asset: "Packaging Line 2",
    subsystem: "Labeller",
    duration_minutes: null,
    observation: "Labels skewed on SKU-204, roughly one in twenty packs.",
    reported_cause: "Label web tension suspected.",
    verified_cause: "",
    action_taken: "Samples pulled for QA review.",
    status: "under_review",
    source: "voice",
    confidence: 0.68,
    transcript: "Labels are going on crooked on SKU two oh four, maybe one in twenty packs.",
  },
];

let sampleIndex = 0;

export function structureRecording(loggedBy: string): ShiftEvent {
  const sample = SAMPLES[sampleIndex % SAMPLES.length]!;
  sampleIndex += 1;
  return {
    ...sample,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    sync: "pending",
    logged_by: loggedBy,
  };
}

export function blankEvent(loggedBy: string): ShiftEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_type: "",
    asset: "Packaging Line 2",
    subsystem: "",
    timestamp: new Date().toISOString(),
    duration_minutes: null,
    observation: "",
    reported_cause: "",
    verified_cause: "",
    action_taken: "",
    status: "unresolved",
    source: "manual",
    confidence: 1,
    transcript: "",
    sync: "pending",
    logged_by: loggedBy,
  };
}
