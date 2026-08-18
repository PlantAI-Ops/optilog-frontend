import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, Mic, Pencil, Plus, Square } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { EventEditor } from "@/components/shift/EventEditor";
import {
  addEvent,
  blankEvent,
  login,
  setState,
  structureRecording,
  unresolvedCount,
  useShiftLog,
  type ShiftEvent,
} from "@/lib/shift-log";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shift-Log — Voice shift logging for production floors" },
      {
        name: "description",
        content:
          "Capture production events by voice in one tap. Offline-first shift logging for operators and supervisors.",
      },
      { property: "og:title", content: "Shift-Log — Voice shift logging" },
      {
        property: "og:description",
        content: "One-tap voice capture of shift events, offline-first, with supervisor review.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const state = useShiftLog();
  if (!state.user) return <LoginScreen />;
  if (!state.shiftActive) return <StartShiftScreen />;
  return <RecordScreen />;
}

/* ------------------------------- login -------------------------------- */

function LoginScreen() {
  const state = useShiftLog();
  const [email, setEmail] = useState("admin@optilog.com");
  const [password, setPassword] = useState("demo1234");

  const handleSubmit = async () => {
    try {
      await login(email, password);
    } catch {
      // error is set in state by login()
    }
  };

  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-6 py-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Sign in</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Your session stays active across shifts.
          </p>
        </div>
        {state.error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive">
            {state.error}
          </div>
        ) : null}
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-14 w-full rounded-2xl border border-input bg-secondary px-4 text-lg outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-14 w-full rounded-2xl border border-input bg-secondary px-4 text-lg outline-none focus:border-ring"
          />
        </label>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={state.loading}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-black text-primary-foreground disabled:opacity-60"
          >
            {state.loading ? <Loader2 className="size-5 animate-spin" /> : null}
            Sign in
          </button>
        </div>
      </div>
    </AppShell>
  );
}

/* ----------------------------- start shift ----------------------------- */

function StartShiftScreen() {
  const state = useShiftLog();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const handleStart = () => {
    setState({ shiftActive: true });
  };

  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-between gap-6 py-4">
        <div className="space-y-6">
          <h1 className="text-3xl font-black tracking-tight">
            {greeting}, {state.user?.name}.
          </h1>
          <dl className="space-y-3 rounded-2xl border border-border bg-card p-4 text-lg">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shift</dt>
              <dd className="font-bold">{state.shiftName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Production area</dt>
              <dd className="font-bold">{state.line}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-bold capitalize">{state.user?.role?.replace(/_/g, " ")}</dd>
            </div>
          </dl>
          {state.error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive">
              {state.error}
            </div>
          ) : null}
          {state.carriedOver.length > 0 ? (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <p className="flex items-center gap-2 text-base font-bold text-warning">
                <AlertTriangle className="size-5" />
                Previous shift: {state.carriedOver.length} unresolved issues
              </p>
              <ul className="mt-3 space-y-2 text-base text-foreground">
                {state.carriedOver.map((issue) => (
                  <li key={issue} className="leading-snug">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleStart}
          className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-2xl font-black text-primary-foreground"
        >
          Start Logging
        </button>
      </div>
    </AppShell>
  );
}

/* ------------------------------- record -------------------------------- */

type Phase = "idle" | "recording" | "processing" | "confirm" | "edit" | "clarify" | "manual";

function RecordScreen() {
  const state = useShiftLog();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ShiftEvent | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [clarifyValue, setClarifyValue] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "recording") {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase]);

  const startRecording = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    setPhase("recording");
  };

  const stopRecording = () => {
    if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
    setPhase("processing");
    window.setTimeout(() => {
      const event = structureRecording(state.user?.name ?? "Operator");
      setDraft(event);
      setPhase("confirm");
    }, 1200);
  };

  const commit = (event: ShiftEvent) => {
    addEvent(event);
    setDraft(null);
    setPhase("idle");
  };

  const confirmDraft = () => {
    if (!draft) return;
    if (draft.duration_minutes === null && draft.status !== "unresolved") {
      setClarifyValue("");
      setPhase("clarify");
      return;
    }
    commit(draft);
  };

  if (phase === "manual" || phase === "edit") {
    const event = phase === "manual" ? blankEvent(state.user?.name ?? "Operator") : draft!;
    return (
      <AppShell title={phase === "manual" ? "New event" : "Edit event"}>
        <EventEditor
          event={event}
          saveLabel="Save to timeline"
          onSave={(e) => commit(e)}
          onCancel={() => setPhase(draft && phase === "edit" ? "confirm" : "idle")}
        />
      </AppShell>
    );
  }

  if (phase === "clarify" && draft) {
    return (
      <AppShell title="One quick question">
        <div className="flex flex-1 flex-col justify-center gap-6">
          <h2 className="text-2xl font-black">How long was the stoppage?</h2>
          <div className="flex items-center gap-3">
            <input
              inputMode="numeric"
              autoFocus
              placeholder="minutes"
              value={clarifyValue}
              onChange={(e) => setClarifyValue(e.target.value)}
              className="h-16 flex-1 rounded-2xl border border-input bg-secondary px-4 text-2xl font-bold outline-none focus:border-ring"
            />
            <button
              type="button"
              aria-label="Answer by voice"
              onClick={() => setClarifyValue("15")}
              className="flex size-16 items-center justify-center rounded-2xl bg-record text-record-foreground"
            >
              <Mic className="size-7" />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => commit(draft)}
              className="h-14 flex-1 rounded-2xl border border-border bg-secondary font-bold"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() =>
                commit({
                  ...draft,
                  duration_minutes: clarifyValue === "" ? null : Number(clarifyValue),
                })
              }
              className="h-14 flex-[2] rounded-2xl bg-primary font-black text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (phase === "confirm" && draft) {
    return (
      <AppShell title="Check this is right">
        <div className="flex flex-1 flex-col gap-5">
          <p className="text-lg font-bold text-muted-foreground">I captured:</p>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-2xl font-black leading-tight">
              {draft.asset} — {draft.event_type}
            </p>
            <CardLine
              label="Time"
              value={new Date(draft.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            />
            {draft.subsystem ? <CardLine label="Subsystem" value={draft.subsystem} /> : null}
            {draft.duration_minutes !== null ? (
              <CardLine label="Duration" value={`~${draft.duration_minutes} minutes`} />
            ) : null}
            <CardLine label="Observation" value={draft.observation} />
            {draft.reported_cause ? (
              <CardLine label="Reported cause" value={draft.reported_cause} />
            ) : null}
            {draft.verified_cause ? (
              <CardLine label="Verified cause" value={draft.verified_cause} />
            ) : null}
            {draft.action_taken ? (
              <CardLine label="Action taken" value={draft.action_taken} />
            ) : null}
          </div>
          <div className="mt-auto space-y-3">
            <button
              type="button"
              onClick={confirmDraft}
              className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-2xl font-black text-primary-foreground"
            >
              <Check className="size-7" /> Confirm
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("edit")}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary font-bold"
              >
                <Pencil className="size-5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setPhase("recording");
                }}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary font-bold"
              >
                <Mic className="size-5" /> Re-record
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const recording = phase === "recording";
  const processing = phase === "processing";

  return (
    <AppShell title={`${state.shiftName} · ${state.line}`}>
      <div className="flex flex-1 flex-col items-center justify-between gap-6 py-2">
        <div className="grid w-full grid-cols-2 gap-3">
          <Stat value={state.events.length} label="events recorded" />
          <Stat value={unresolvedCount(state)} label="unresolved" warn />
        </div>

        <div className="flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
            className={`flex size-56 flex-col items-center justify-center gap-2 rounded-full text-record-foreground transition-transform active:scale-95 ${
              recording ? "record-pulse bg-record" : "bg-record"
            } ${processing ? "opacity-60" : ""}`}
          >
            {recording ? <Square className="size-16" /> : <Mic className="size-20" />}
            <span className="text-2xl font-black tracking-wide">
              {processing ? "…" : recording ? "STOP" : "RECORD"}
            </span>
          </button>
          <p className="h-7 text-lg font-bold text-muted-foreground">
            {recording
              ? `Listening — ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
              : processing
                ? "Writing up your event…"
                : "Tap once, speak one event."}
          </p>
          {recording ? (
            <div className="flex h-10 items-end gap-1.5">
              {Array.from({ length: 13 }).map((_, i) => (
                <span
                  key={i}
                  className="w-2 animate-pulse rounded-full bg-record"
                  style={{
                    height: `${20 + ((i * 37) % 60)}%`,
                    animationDelay: `${i * 70}ms`,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="w-full space-y-3">
          <Link
            to="/timeline"
            className="flex h-16 w-full items-center justify-center rounded-2xl border border-border bg-secondary text-lg font-bold text-secondary-foreground"
          >
            View Shift
          </Link>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPhase("manual")}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold"
            >
              <Plus className="size-5" /> Manual
            </button>
            <Link
              to="/end-shift"
              className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-border bg-card font-bold"
            >
              End Shift
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p
        className={`text-4xl font-black ${warn && value > 0 ? "text-warning" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function CardLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg leading-snug">{value}</p>
    </div>
  );
}
