import { useSyncExternalStore } from "react";
import { ApiError, api, clearToken, getToken, setRefreshToken, setToken } from "./api";
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
  /** Optional plant vocabulary fed to speech recognition (older backends omit it). */
  industry?: string;
  key_terms?: string[];
  language_notes?: string;
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
  /** Server recording id, set once the voice upload lands (see addEvent). */
  recording_id?: string | undefined;
  /** Plant line/area the operator selected before logging (persisted server-side). */
  line_id?: string | null;
  area_id?: string | null;
  /** Owner of the event server-side — gates edit/delete for non-supervisors. */
  operator_id?: string | null;
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
  /** Area picked on the start screen (adjustable before Start Logging). */
  areaId: string | null;
  area: string;
  /** Team the confirmed shift belongs to (set when logging starts). */
  teamId?: string | null;
  teamName?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  handover: string;
  reportApproved: boolean;
  events: ShiftEvent[];
  /** Events removed locally — kept so a server refetch cannot resurrect them. */
  deletedIds: string[];
  /** Ids whose server-side DELETE is still queued (offline). */
  pendingDeletes: string[];
  /** ISO end of the plant's current shift window (auto-end countdown source). */
  windowEnd: string | null;
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
  areaId: null,
  area: "",
  startedAt: null,
  endedAt: null,
  handover: "",
  reportApproved: false,
  events: [],
  deletedIds: [],
  pendingDeletes: [],
  windowEnd: null,
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
    deletedIds: [],
    pendingDeletes: [],
    windowEnd: null,
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

/**
 * Record the operator's chosen line/area for this shift on the backend
 * (`POST /operator-shifts/start`). Non-blocking by design: a 409 means the
 * session is already active and an offline device simply logs locally —
 * neither should stop the operator from starting. Off-shift operators pass
 * the supervisor approval id that unlocks the start (single-use server-side).
 */
export async function startLoggingSession(
  shiftId: string | null,
  lineId: string | null,
  areaId: string | null,
  approvalId?: string | null,
): Promise<void> {
  if (!shiftId) return;
  try {
    await api.post("/operator-shifts/start", {
      shift_id: shiftId,
      line_id: lineId || null,
      area_id: areaId || null,
      approval_id: approvalId || null,
    });
  } catch {
    /* session already active / offline / backend older than this feature */
  }
}

export async function endShift(handover: string): Promise<void> {
  if (!state.shiftId) return;
  setState({ loading: true, error: null });
  try {
    // Make sure an operator session exists to close (operators who were already
    // mid-shift when this shipped never called start; errors are swallowed).
    await startLoggingSession(state.shiftId, state.lineId, state.areaId);
    try {
      await api.post(`/shifts/${state.shiftId}/end`, {
        // Backend `ShiftEnd.handover` is a plain string — the old object payload
        // was rejected with 422 before the handler ever ran.
        handover: handover || "Shift completed",
      });
    } catch (e) {
      // 404 = no open session left: the shift-window worker already closed it,
      // which means the shift ended for this operator either way.
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
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

/**
 * Save an event locally and POST it when online.
 *
 * Returns the server id once the POST lands (null otherwise) so callers can
 * patch in data that only resolves afterwards — e.g. the voice recording id
 * from an upload still in flight.
 */
export async function addEvent(event: ShiftEvent): Promise<string | null> {
  // Stamp ownership at capture time so edit/delete rights can be evaluated
  // even before the server echoes its copy back.
  const owned: ShiftEvent = {
    ...event,
    operator_id: event.operator_id ?? state.user?.id ?? null,
  };
  setState((s) => ({ events: [...s.events, owned] }));
  if (!state.shiftId || !state.online) return null;
  try {
    const created = await api.post<{ id?: string }>(`/shifts/${state.shiftId}/events`, owned);
    setState((s) => ({
      events: s.events.map((e) => (e.id === owned.id ? { ...e, sync: "synced" as const } : e)),
    }));
    return created?.id ?? null;
  } catch {
    /* will be retried by syncPending */
    return null;
  }
}

export function updateEvent(id: string, patch: Partial<ShiftEvent>) {
  setState((s) => ({
    events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

/** Backend `EventUpdate.event_type` is a closed Literal — free text from a
 *  mistyped edit stays local instead of failing the whole PATCH with 422. */
const SERVER_EVENT_TYPES = new Set([
  "downtime",
  "production",
  "quality",
  "maintenance",
  "safety",
  "environmental",
  "observation",
  "breakdown",
]);

function toServerPatch(patch: Partial<ShiftEvent>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.event_type !== undefined) {
    if (SERVER_EVENT_TYPES.has(patch.event_type)) body["event_type"] = patch.event_type;
  }
  for (const field of [
    "observation",
    "reported_cause",
    "suspected_cause",
    "verified_cause",
    "action_taken",
    "severity",
    "status",
  ] as const) {
    if (patch[field] !== undefined) body[field] = patch[field];
  }
  if (patch.duration_minutes !== undefined) {
    body["duration_seconds"] = patch.duration_minutes === null ? null : patch.duration_minutes * 60;
  }
  return body;
}

/**
 * Edit an event: local state always wins instantly (the store is the source of
 * truth for the shift), and a PATCH is pushed for events that already exist
 * server-side. Events still awaiting their first sync are re-posted in full by
 * `syncPending`, which reads the (now edited) state.
 */
export async function saveEvent(id: string, patch: Partial<ShiftEvent>): Promise<void> {
  const previous = state.events.find((e) => e.id === id);
  updateEvent(id, patch);
  if (!previous || previous.sync !== "synced" || !state.online) return;
  const body = toServerPatch(patch);
  if (Object.keys(body).length === 0) return;
  try {
    await api.patch(`/events/${id}`, body);
  } catch {
    /* local edit kept; server copy catches up on the next full refetch */
  }
}

/**
 * Delete an event (bad transcription, duplicate, wrong line…). The row leaves
 * the store immediately; the id is remembered so `mergeEvents` cannot pull it
 * back from a server refetch until the DELETE has actually landed.
 */
export async function deleteEvent(id: string): Promise<void> {
  const previous = state.events.find((e) => e.id === id);
  if (!previous) return;
  const remember = (s: ShiftState): ShiftState => ({
    ...s,
    events: s.events.filter((e) => e.id !== id),
    deletedIds: s.deletedIds.includes(id) ? s.deletedIds : [...s.deletedIds, id],
  });

  if (previous.sync === "pending") {
    // Never created server-side — dropping it locally is the whole delete.
    setState(remember);
    return;
  }
  if (!state.online) {
    setState((s) => ({
      ...remember(s),
      pendingDeletes: s.pendingDeletes.includes(id) ? s.pendingDeletes : [...s.pendingDeletes, id],
    }));
    return;
  }
  try {
    await api.del(`/events/${id}`);
    setState(remember);
  } catch (e: unknown) {
    // Keep the row visible when the server refuses (offline race, role rule…)
    // rather than hiding an event that still exists.
    const message = e instanceof Error ? e.message : "Failed to delete event";
    setState({ error: message });
    throw e;
  }
}

/* -------------------------------------------------------------------------- */
/*                                  sync                                      */
/* -------------------------------------------------------------------------- */

export function setOnline(online: boolean) {
  setState({ online });
  if (online) syncPending();
}

export async function syncPending(): Promise<void> {
  if (syncing || !state.online) return;
  syncing = true;

  // Queued deletes first: they only need connectivity, not an open shift.
  for (const id of [...state.pendingDeletes]) {
    try {
      await api.del(`/events/${id}`);
      setState((s) => ({ pendingDeletes: s.pendingDeletes.filter((d) => d !== id) }));
    } catch {
      /* will retry on next sync */
    }
  }

  if (state.shiftId) {
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
    logged_by: e.operator_name ?? "",
    operator_id: e.operator_id ?? null,
    // The server keeps the audio link in `source.record_id`; mirroring it here
    // is what lets the timeline play the recording back.
    recording_id: e.source_record_id || undefined,
  };
}

export function mergeEvents(serverEvents: MyEvent[]) {
  const mapped = serverEvents.map(mapMyEventToShiftEvent);
  setState((s) => {
    const localIds = new Set(s.events.map((ev) => ev.id));
    const deleted = new Set(s.deletedIds);
    const newEvents = mapped.filter(
      (ev) =>
        !localIds.has(ev.id) &&
        !deleted.has(ev.id) &&
        (ev.status as unknown as string) !== "deleted",
    );
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
