import { useSyncExternalStore } from "react";

export type Role = "operator" | "supervisor";
export type EventStatus = "resolved" | "unresolved" | "under_review";
export type SyncState = "pending" | "synced";

export interface ShiftEvent {
  id: string;
  event_type: string;
  asset: string;
  subsystem: string;
  timestamp: string; // ISO
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

export interface ShiftState {
  user: { name: string; role: Role } | null;
  shiftActive: boolean;
  shiftName: string;
  line: string;
  startedAt: string | null;
  endedAt: string | null;
  handover: string;
  reportApproved: boolean;
  events: ShiftEvent[];
  carriedOver: string[];
  online: boolean;
}

const STORAGE_KEY = "shiftlog.state.v1";

const initialState: ShiftState = {
  user: null,
  shiftActive: false,
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
};

let state: ShiftState = initialState;
let hydrated = false;
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

/* ------------------------------ actions ------------------------------ */

export function login(name: string, role: Role) {
  setState({ user: { name, role } });
}

export function logout() {
  setState({ user: null });
}

export function startShift() {
  setState({
    shiftActive: true,
    startedAt: new Date().toISOString(),
    endedAt: null,
    reportApproved: false,
  });
}

export function endShift(handover: string) {
  setState({ shiftActive: false, endedAt: new Date().toISOString(), handover });
}

export function addEvent(event: ShiftEvent) {
  setState((s) => ({ events: [...s.events, event] }));
  if (state.online) syncPending();
}

export function updateEvent(id: string, patch: Partial<ShiftEvent>) {
  setState((s) => ({
    events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

export function setOnline(online: boolean) {
  setState({ online });
  if (online) syncPending();
}

export function syncPending() {
  window.setTimeout(() => {
    if (!state.online) return;
    setState((s) => ({
      events: s.events.map((e) => (e.sync === "pending" ? { ...e, sync: "synced" as const } : e)),
    }));
  }, 1600);
}

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
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
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
  const sample = SAMPLES[sampleIndex % SAMPLES.length];
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