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
  /** Display names for the timeline cards (stamped at capture, filled by merges). */
  line_name?: string | undefined;
  area_name?: string | undefined;
  /** Owner of the event server-side — gates edit/delete for non-supervisors. */
  operator_id?: string | null;
  /** Shift the event belongs to (server-stamped). Used to keep merges scoped
   *  to the active shift so another shift's events cannot leak in. */
  shift_id?: string | null;
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
  /** Unsynced events from ended/closed shifts awaiting upload (outbox). */
  outbox: ShiftEvent[];
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

/**
 * Reset operator/shift-scoped state so a different operator logging into the
 * same device never sees the previous operator's events, line, area, or shift.
 * Kept in sync with the fields `logout()` clears.
 */
function resetOperatorState(s: ShiftState): Partial<ShiftState> {
  return {
    user: null,
    shiftActive: false,
    shiftId: null,
    shiftName: "Morning",
    shiftType: null,
    lineId: null,
    line: "Packaging Line 2",
    areaId: null,
    area: "",
    teamId: null,
    teamName: null,
    startedAt: null,
    endedAt: null,
    events: [],
    outbox: [],
    deletedIds: [],
    pendingDeletes: [],
    windowEnd: null,
    carriedOver: [],
    handover: "",
    reportApproved: false,
    error: null,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  store                                     */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY_PREFIX = "shiftlog.state.v1";
const LEGACY_STORAGE_KEY = "shiftlog.state.v1";

function storageKeyFor(userId: string | null | undefined): string {
  return userId ? `${STORAGE_KEY_PREFIX}.${userId}` : `${STORAGE_KEY_PREFIX}.guest`;
}

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
  outbox: [],
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
    // Synced events already live on the server and can be re-fetched via
    // /my-events — they don't need to keep sitting in localStorage. Only
    // pending (unsynced) voice logs are worth persisting for offline mode.
    const toPersist = {
      ...state,
      events: state.events.filter((e) => e.sync !== "synced"),
      outbox: state.outbox.filter((e) => e.sync !== "synced"),
    };
    window.localStorage.setItem(storageKeyFor(state.user?.id), JSON.stringify(toPersist));
  } catch {
    /* storage full — keep in-memory copy */
  }
}

function hydrate(userId?: string | null) {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    let raw = window.localStorage.getItem(storageKeyFor(userId));
    // One-time migration: read from legacy shared key if operator bucket doesn't exist yet
    if (!raw && userId) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (raw) state = { ...initialState, ...(JSON.parse(raw) as ShiftState) };
    // A page reload always ends any in-flight request — never resume in loading state.
    state = { ...state, loading: false };
  } catch {
    /* ignore corrupt payload */
  }
}

/**
 * Force a fresh hydrate from a specific operator's bucket. Used after login /
 * restoreSession resolves the user, so we load that operator's own persisted
 * state instead of the shared guest bucket.
 */
function rehydrateForUser(userId: string) {
  hydrated = false;
  hydrate(userId);
}

/**
 * Keep only events that belong to today's date and the active shift. Strips
 * yesterday's events and other operators' events from the local store so a
 * returning operator never sees a previous shift's logs.
 */
function scopeEventsToActiveShift(s: ShiftState): ShiftState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...s,
    events: s.events.filter((e) => {
      const eventDate = e.timestamp.slice(0, 10);
      return eventDate === today && (!s.shiftId || e.shift_id === s.shiftId);
    }),
  };
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

    // Different operator on this device — clear the previous operator's
    // shift-scoped state so their events/shift/line never leak in.
    if (state.user?.id && state.user.id !== user.id) {
      setState(resetOperatorState);
    }

    // Load this operator's own persisted bucket (unsynced offline events, etc.)
    rehydrateForUser(user.id);
    setState({ user, loading: false });

    // Only today's events for the active shift survive into the session.
    setState(scopeEventsToActiveShift);

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

    // Different operator on this device — clear the previous operator's
    // shift-scoped state so their events/shift/line never leak in.
    if (state.user?.id && state.user.id !== user.id) {
      setState(resetOperatorState);
    }

    // Load this operator's own persisted bucket (unsynced offline events, etc.)
    rehydrateForUser(user.id);
    setState({ user, loading: false });

    // Only today's events for the active shift survive into the session.
    setState(scopeEventsToActiveShift);

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
  // Full session reset: anything scoped to the operator/shift (line, area,
  // team, carried-over list, events…) must not survive into the next login —
  // a different user may pick up this device.
  const currentUserId = state.user?.id;
  setState({
    user: null,
    shiftActive: false,
    shiftId: null,
    shiftName: "Morning",
    shiftType: null,
    lineId: null,
    line: "Packaging Line 2",
    areaId: null,
    area: "",
    teamId: null,
    teamName: null,
    startedAt: null,
    endedAt: null,
    events: [],
    outbox: [],
    deletedIds: [],
    pendingDeletes: [],
    windowEnd: null,
    carriedOver: [],
    handover: "",
    reportApproved: false,
    error: null,
  });
  // Wipe this operator's bucket from localStorage so the next operator
  // logging into the same device starts from a clean slate.
  if (typeof window !== "undefined" && currentUserId) {
    window.localStorage.removeItem(storageKeyFor(currentUserId));
  }
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
    // Remove the legacy shared key and every per-operator bucket so no
    // operator's state survives on a shared device.
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(`${STORAGE_KEY_PREFIX}.`) || k === LEGACY_STORAGE_KEY)
      .forEach((k) => window.localStorage.removeItem(k));
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
      // Move unsynced events to the outbox so they survive for retry when
      // connectivity returns. Synced events are already on the server and can
      // be re-fetched, so they don't need to linger locally.
      outbox: [...(state.outbox ?? []), ...state.events.filter((e) => e.sync !== "synced")],
      events: [],
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
  // even before the server echoes its copy back. Location display names come
  // from the shift's picks so every card can show area · line immediately.
  const owned: ShiftEvent = {
    ...event,
    operator_id: event.operator_id ?? state.user?.id ?? null,
    shift_id: event.shift_id ?? state.shiftId,
    line_id: event.line_id ?? state.lineId,
    area_id: event.area_id ?? state.areaId,
    line_name: event.line_name ?? pickName(state.line),
    area_name: event.area_name ?? pickName(state.area),
  };
  // Dedup: don't append an event that's conceptually already logged.
  const existing = state.events.find(
    (e) =>
      e.event_type === event.event_type &&
      e.asset === event.asset &&
      e.timestamp === event.timestamp &&
      e.observation === event.observation &&
      e.operator_id === event.operator_id &&
      e.shift_id === event.shift_id,
  );
  if (existing) return existing.id;

  setState((s) => ({ events: [...s.events, owned] }));
  if (!state.shiftId || !state.online) return null;
  try {
    const created = await api.post<{ id?: string }>(`/shifts/${state.shiftId}/events`, owned);
    if (created?.id) {
      // Align the local id with the server id so mergeEvents dedups on refetch.
      const serverId = created.id as string;
      setState((s) => ({
        events: s.events.map((e) =>
          e.id === owned.id ? { ...e, id: serverId, sync: "synced" as const } : e,
        ),
      }));
    } else {
      setState((s) => ({
        events: s.events.map((e) => (e.id === owned.id ? { ...e, sync: "synced" as const } : e)),
      }));
    }
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

  // Retry pending events for the currently active shift.
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

  // Retry outbox events from ended/closed shifts. The backend accepts
  // POST /shifts/{shift_id}/events even after a shift is closed, so these
  // can still land when the device comes back online.
  for (const event of [...state.outbox]) {
    if (event.sync !== "pending") continue;
    try {
      await api.post(`/shifts/${event.shift_id}/events`, event);
      setState((s) => ({
        outbox: s.outbox.map((e) => (e.id === event.id ? { ...e, sync: "synced" as const } : e)),
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
  return (
    s.events.filter((e) => e.sync === "pending").length +
    s.outbox.filter((e) => e.sync === "pending").length
  );
}

export function unresolvedCount(s: ShiftState) {
  return s.events.filter((e) => e.status !== "resolved").length;
}

/**
 * "Bagging Area · Line 3" — where the operator is logging, for the shift
 * headers. The area picked on the start screen comes first; the line only
 * joins when one was actually chosen (`line` falls back to the literal
 * "Unassigned" when the picked area has no lines, which must not leak in).
 * Renders "Unassigned" when neither is known.
 */
export function locationLabel(s: Pick<ShiftState, "area" | "line">): string {
  const parts = [s.area?.trim(), s.line?.trim()].filter(
    (p): p is string => !!p && p !== "Unassigned",
  );
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(" · ") : "Unassigned";
}

/** A display name worth stamping on an event (drops the "Unassigned" stub). */
function pickName(name: string | null | undefined): string | undefined {
  const value = name?.trim();
  return value && value !== "Unassigned" ? value : undefined;
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
    shift_id: e.shift_id ?? null,
    line_id: e.line_id || null,
    area_id: e.area_id ?? null,
    line_name: e.line_name || "",
    area_name: e.area_name ?? "",
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
        (ev.status as unknown as string) !== "deleted" &&
        // Shift-scoped: while a shift is active, never pull in events that
        // belong to another shift (e.g. the same operator on an earlier shift
        // the same day). Events without a shift_id (older backends) still pass.
        (!s.shiftId || !ev.shift_id || ev.shift_id === s.shiftId) &&
        // Operator-scoped: never surface another operator's events.
        (!s.user?.id || !ev.operator_id || ev.operator_id === s.user.id),
    );
    if (newEvents.length === 0) return s;
    return { events: [...s.events, ...newEvents] };
  });
}

async function fetchEventsFromServer(user: User) {
  const plantId = user.plant_ids?.[0];
  if (!plantId) return;
  // Only pre-load events once a shift is active — and only that shift's
  // events. Merging "everything today" here is what leaked a previous
  // shift's issues into a new session (same operator, same date).
  const shiftId = state.shiftId;
  if (!shiftId) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const events = await api.get<MyEvent[]>(
      `/plants/${plantId}/my-events?date=${today}&shift_id=${shiftId}`,
    );
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
