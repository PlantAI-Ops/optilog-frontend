import { useSyncExternalStore } from "react";
import { api, clearToken, getToken, setRefreshToken, setToken } from "./api";
import type { MyEvent } from "./hooks";
import { useId } from "react";

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

export type EventStatus =
  "draft" | "confirmed" | "investigating" | "resolved" | "planned_maintenance";
export type SyncState = "pending" | "synced";

/* -------------------------------------------------------------------------- */
/*                               admin types                                  */
/* -------------------------------------------------------------------------- */

export type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

export interface TenantConfig {
  rca_enabled: boolean;
  integrations_enabled: boolean;
  analytics_enabled: boolean;
  max_events_per_month: number | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  status: TenantStatus;
  trial_ends_at: string | null;
  max_users: number;
  max_plants: number;
  config: TenantConfig;
  created_at: string;
  updated_at: string;
}

export interface AdminPlant {
  id: string;
  tenant_id: string;
  name: string;
  location: string;
  timezone: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role: Role;
  plant_ids: string[];
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

export type SeedPreset = "minimal" | "standard" | "full";

export interface ShiftEvent {
  id: string;
  event_type: string;
  asset: string;
  subsystem: string;
  timestamp: string;
  duration_minutes: number | null;
  observation: string;
  reported_cause: string;
  suspected_cause: string;
  verified_cause: string;
  action_taken: string;
  severity: string;
  status: EventStatus;
  source: "voice" | "manual";
  confidence: number;
  transcript: string;
  sync: SyncState;
  logged_by: string;
  recording_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant_id: string;
  plant_ids: string[];
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  tenant_name: string | null;
  plant_ids: string[];
  /** plant_id -> plant_name, resolved server-side (missing ids = deleted plants) */
  plant_names?: Record<string, string>;
  /** team name the user belongs to, resolved server-side (null/absent = no team) */
  team_name?: string | null;
  active: boolean;
  created_at: string;
}

export interface ShiftState {
  user: User | null;
  shiftActive: boolean;
  shiftId: string | null;
  shiftName: string;
  shiftType: string | null;
  lineId: string | null;
  line: string;
  /** Team the confirmed shift belongs to (set when logging starts). */
  teamId?: string | null;
  teamName?: string | null;
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

/** Voice logging (start shift → record → timeline → end shift → report) is a
 * floor tool: operator, technician and supervisor only. shift_manager and
 * above get the manager home on `/` instead. */
export function canLogShift(role: Role | undefined): boolean {
  return !!role && !hasMinRole(role, "shift_manager");
}

/** Plant managers and above never belong to a crew — they are excluded from
 * team member pickers (one-team-per-user does not apply to them). */
export function canBeTeamMember(role: Role | string | undefined): boolean {
  return !!role && !hasMinRole(role as Role, "plant_manager");
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
  shiftType: null,
  lineId: null,
  line: "Packaging Line 2",
  startedAt: null,
  endedAt: null,
  handover: "",
  reportApproved: false,
  events: [],
  carriedOver: [],
  online: true,
  loading: true,
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

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...initialState, ...(JSON.parse(raw) as ShiftState) };
    // A page reload always ends any in-flight request — never resume in loading state.
    state = { ...state, loading: false };
  } catch {
    /* ignore corrupt payload */
  }
}

export function setState(patch: Partial<ShiftState> | ((s: ShiftState) => Partial<ShiftState>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  persist();
  emit();
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShiftLog(): ShiftState {
  hydrate();
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
    fetchEventsFromServer(user);
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : "Login failed";
    let message: string;
    if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
      message = "Unable to connect. Check your internet connection.";
    } else if (
      raw.includes("401") ||
      raw.toLowerCase().includes("unauthorized") ||
      raw.toLowerCase().includes("invalid")
    ) {
      message = "Invalid email or password.";
    } else {
      message = raw;
    }
    setState({ error: message, loading: false });
    throw e;
  }
}

export async function restoreSession(): Promise<void> {
  const token = getToken();
  if (!token) {
    setState({ loading: false });
    return;
  }
  setState({ loading: true });
  try {
    const user = await api.get<User>("/auth/me");
    setState({ user, loading: false });
    fetchEventsFromServer(user);
  } catch (e: unknown) {
    clearToken();
    setState({ user: null, loading: false });
    if (e instanceof Error && "status" in e && (e as { status: number }).status === 401) {
      throw e;
    }
  }
}

let restoreSessionPromise: Promise<void> | null = null;

export function getRestoreSessionPromise(): Promise<void> {
  if (!restoreSessionPromise) {
    restoreSessionPromise = restoreSession();
  }
  return restoreSessionPromise;
}

export function logout() {
  clearToken();
  setState({
    user: null,
    shiftActive: false,
    shiftId: null,
    shiftType: null,
    startedAt: null,
    endedAt: null,
    events: [],
    handover: "",
    reportApproved: false,
    error: null,
  });
}

/**
 * Sign out and hard-navigate to the login screen (`/` hosts `LoginScreen`)
 * WITHOUT touching the in-memory store: `setState` would flush a re-render of
 * the current (console) page with `user: null` before the browser unloads it,
 * visibly emptying the dashboard first. Token + persisted state are cleared
 * directly instead, and `location.replace` keeps the console out of history.
 * The full reload also discards the React Query cache.
 */
export function logoutHard(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.location.replace("/");
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
    await api.post(`/shifts/${state.shiftId}/end`, {
      operator_id: state.user?.id,
      handover: {
        summary: handover || "Shift completed",
        open_items: state.events
          .filter((e) => e.status !== "resolved")
          .map((e) => ({
            description: e.observation || e.event_type,
            severity: e.event_type === "breakdown" ? "high" : "medium",
            assigned_to: "next_shift",
          })),
      },
    });
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
  return s.events.filter((e) => e.status !== "resolved").length;
}

export function mapMyEventToShiftEvent(e: MyEvent): ShiftEvent {
  return {
    id: e.id,
    event_type: e.event_type ?? "",
    asset: e.asset_name ?? "",
    subsystem: "",
    timestamp: e.timestamp,
    duration_minutes: e.duration_seconds != null ? Math.round(e.duration_seconds / 60) : null,
    observation: e.observation ?? "",
    reported_cause: e.reported_cause ?? "",
    suspected_cause: e.suspected_cause ?? "",
    verified_cause: e.verified_cause ?? "",
    action_taken: e.action_taken ?? "",
    severity: e.severity ?? "",
    status: (e.status as EventStatus) || "draft",
    source: e.source === "voice" ? "voice" : "manual",
    confidence: 1,
    transcript: "",
    sync: "synced",
    logged_by: "",
  };
}

export function mergeEvents(serverEvents: MyEvent[]) {
  const mapped = serverEvents.map(mapMyEventToShiftEvent);
  setState((s) => {
    const localIds = new Set(s.events.map((ev) => ev.id));
    const newEvents = mapped.filter((ev) => !localIds.has(ev.id));
    if (newEvents.length === 0) return s;
    return { events: [...s.events, ...newEvents] };
  });
}

async function fetchEventsFromServer(user: User) {
  const plantId = user.plant_ids?.[0];
  if (!plantId) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const events = await api.get<MyEvent[]>(`/plants/${plantId}/my-events?date=${today}`);
    mergeEvents(events);
  } catch {
    /* non-critical — events will load on timeline navigation */
  }
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

let eventCounter = 0;

export const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  investigating: "Investigating",
  resolved: "Resolved",
  planned_maintenance: "Planned maintenance",
};

export function blankEvent(loggedBy: string): ShiftEvent {
  if (typeof window === "undefined") {
    return {
      id: `evt_ssr_${++eventCounter}`,
      event_type: "",
      asset: "Packaging Line 2",
      subsystem: "",
      timestamp: new Date().toISOString(),
      duration_minutes: null,
      observation: "",
      reported_cause: "",
      suspected_cause: "",
      verified_cause: "",
      action_taken: "",
      severity: "",
      status: "draft",
      source: "manual",
      confidence: 1,
      transcript: "",
      sync: "pending",
      logged_by: loggedBy,
    };
  }
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_type: "",
    asset: "Packaging Line 2",
    subsystem: "",
    timestamp: new Date().toISOString(),
    duration_minutes: null,
    observation: "",
    reported_cause: "",
    suspected_cause: "",
    verified_cause: "",
    action_taken: "",
    severity: "",
    status: "draft",
    source: "manual",
    confidence: 1,
    transcript: "",
    sync: "pending",
    logged_by: loggedBy,
  };
}
