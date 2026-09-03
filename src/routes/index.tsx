import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, Mic, Pencil, Plus, Square } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { EventEditor } from "@/components/shift/EventEditor";
import { useCurrentShift, useCarriedOver, transcribeAudio } from "@/lib/hooks";
import { postFormData } from "@/lib/api";
import {
  addEvent,
  blankEvent,
  login,
  setState,
  type EventStatus,
  unresolvedCount,
  useShiftLog,
  type ShiftEvent,
} from "@/lib/shift-log";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OptiLog — Voice shift logging for production floors" },
      {
        name: "description",
        content:
          "Capture production events by voice in one tap. Offline-first shift logging for operators and supervisors.",
      },
      { property: "og:title", content: "OptiLog — Voice shift logging" },
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
        <div className="flex flex-col items-center text-center">
          <img src="/optilog-logo.svg" alt="OptiLog" className="mb-4 h-20 w-20" />
          <h1 className="text-3xl font-black tracking-tight">OptiLog</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Sign in to continue
          </p>
        </div>
        {state.error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive break-words">
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
  const plantId = state.user?.plant_ids?.[0];
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const currentShift = useCurrentShift(plantId);
  const shift = currentShift.data?.current_shift;
  const lines = currentShift.data?.lines ?? [];

  const [selectedLineId, setSelectedLineId] = useState<string>("");

  const carriedOver = useCarriedOver(plantId, shift?.shift_type, today);
  const issues = carriedOver.data?.issues ?? [];

  const selectedLine = lines.find((l) => l.id === selectedLineId);

  const canStart = !!shift && !!selectedLineId;

  const handleStart = () => {
    if (!canStart) return;
    setState({
      shiftActive: true,
      shiftId: shift.shift_id,
      shiftName: shift.name,
      shiftType: shift.shift_type,
      lineId: selectedLineId,
      line: selectedLine?.name ?? "Line",
      carriedOver: issues,
    });
  };

  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-between gap-6 py-4">
        <div className="space-y-6">
          <h1 className="text-3xl font-black tracking-tight">
            {greeting}, {state.user?.name}.
          </h1>

          {currentShift.isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : currentShift.error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive">
              Failed to load shift info.
            </div>
          ) : shift ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shift</dt>
                <dd className="font-bold">
                  {shift.name} ({shift.start}–{shift.end})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Team</dt>
                <dd className="font-bold">{shift.team_name || "—"}</dd>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Production area
                </span>
                {lines.length > 0 ? (
                  <select
                    value={selectedLineId}
                    onChange={(e) => setSelectedLineId(e.target.value)}
                    className="mt-1 h-14 w-full rounded-2xl border border-input bg-secondary px-4 text-lg font-bold outline-none focus:border-ring"
                  >
                    <option value="">Select line…</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No production areas configured for your plant.
                  </p>
                )}
              </label>

              <div className="flex justify-between pt-1">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-bold capitalize">{state.user?.role?.replace(/_/g, " ")}</dd>
              </div>
            </div>
          ) : null}

          {shift?.status === "pending" && (
            <div className="rounded-2xl border border-info/40 bg-info/10 p-4">
              <p className="text-base font-medium text-info">
                No scheduled shift today. Events will be logged to a pending shift.
              </p>
            </div>
          )}

          {state.error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive break-words">
              {state.error}
            </div>
          ) : null}

          {selectedLineId ? (
            carriedOver.isLoading ? null : issues.length > 0 ? (
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
                <p className="flex items-center gap-2 text-base font-bold text-warning">
                  <AlertTriangle className="size-5" />
                  Previous shift: {issues.length} unresolved issues
                </p>
                <ul className="mt-3 space-y-2 text-base text-foreground">
                  {issues.map((issue, i) => (
                    <li key={i} className="leading-snug break-words">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            ) : !carriedOver.isLoading && carriedOver.isSuccess ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <p className="text-base font-medium text-muted-foreground">
                  No carryover issues from previous shift
                </p>
              </div>
            ) : null
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-2xl font-black text-primary-foreground disabled:opacity-40"
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
  const plantId = state.user?.plant_ids?.[0];
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ShiftEvent | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [clarifyValue, setClarifyValue] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const rafIdRef = useRef<number>(0);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    return () => {
      stopAudioAnalyser();
    };
  }, []);

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

  const startAudioAnalyser = (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    const updateRing = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const level = avg / 255;

      if (buttonRef.current) {
        const baseSpread = 8;
        const maxSpread = 35;
        const spread = baseSpread + level * maxSpread;
        const opacity = 0.2 + level * 0.6;
        buttonRef.current.style.boxShadow =
          `0 0 ${spread}px rgba(239, 68, 68, ${opacity})`;
      }
      rafIdRef.current = requestAnimationFrame(updateRing);
    };

    rafIdRef.current = requestAnimationFrame(updateRing);
  };

  const stopAudioAnalyser = () => {
    cancelAnimationFrame(rafIdRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
  };

  const startRecording = async () => {
    if (navigator.vibrate) navigator.vibrate(40);
    setLiveTranscript("");
    setAudioBlob(null);
    audioChunksRef.current = [];
    finalTranscriptRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start audio analyser for ring animation
      startAudioAnalyser(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const chunks = audioChunksRef.current;
        const blob =
          chunks.length > 0 ? new Blob(chunks, { type: mediaRecorder.mimeType }) : null;

        const browserTranscript = finalTranscriptRef.current || liveTranscript;

        if (blob) {
          setAudioBlob(blob);
          transcribeAudio(blob, plantId, state.shiftId ?? undefined, browserTranscript)
            .then((result) => {
              const event: ShiftEvent = {
                ...blankEvent(state.user?.name ?? "Operator"),
                event_type: result.structured_event.event_type ?? "",
                asset: result.structured_event.asset_name ?? state.line,
                subsystem: result.structured_event.subsystem ?? "",
                observation: result.structured_event.observation ?? "",
                reported_cause: result.structured_event.reported_cause ?? "",
                suspected_cause: result.structured_event.suspected_cause ?? "",
                verified_cause: result.structured_event.verified_cause ?? "",
                action_taken: result.structured_event.action_taken ?? "",
                severity: result.structured_event.severity ?? "",
                status: (result.structured_event.status as EventStatus) || "draft",
                duration_minutes: result.structured_event.duration_seconds
                  ? Math.round(result.structured_event.duration_seconds / 60)
                  : null,
                transcript: browserTranscript,
                source: "voice",
              };
              setDraft(event);
              setPhase("confirm");
            })
            .catch((err) => {
              console.error("Transcription failed:", err);
              const event: ShiftEvent = {
                ...blankEvent(state.user?.name ?? "Operator"),
                transcript: browserTranscript,
                source: "voice",
              };
              setDraft(event);
              setPhase("confirm");
            });
        } else {
          const event: ShiftEvent = {
            ...blankEvent(state.user?.name ?? "Operator"),
            transcript: browserTranscript,
            source: "voice",
          };
          setDraft(event);
          setPhase("confirm");
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error("Microphone access failed:", err);
      setMicBlocked(true);
      setState({
        error: "Microphone access denied. Allow mic access in your browser settings, then try again.",
      });
      return;
    }

    // Web Speech API for live preview
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i]![0]!.transcript;
          if (event.results[i]!.isFinal) {
            finalTranscriptRef.current +=
              (finalTranscriptRef.current ? " " : "") + text;
          } else {
            interim += text;
          }
        }
        setLiveTranscript(
          finalTranscriptRef.current + (interim ? " " + interim : ""),
        );
      };
      recognition.onerror = () => {
        // Speech recognition error — silently continue
      };
      recognition.start();
      recognitionRef.current = recognition;
    }

    setPhase("recording");
  };

  const stopRecording = () => {
    if (navigator.vibrate) navigator.vibrate([20, 60, 20]);

    stopAudioAnalyser();

    if (buttonRef.current) {
      buttonRef.current.style.boxShadow = "";
    }

    setPhase("processing");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const commit = async (event: ShiftEvent) => {
    addEvent(event);
    // Save audio recording if user confirmed and audio exists
    if (audioBlob && event.id) {
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");
        formData.append("event_id", event.id);
        await postFormData("/recordings", formData);
      } catch {
        // Recording save failed — event is still saved
      }
    }
    setDraft(null);
    setAudioBlob(null);
    setPhase("idle");
  };

  const confirmDraft = () => {
    if (!draft) return;
    if (draft.duration_minutes === null && draft.status === "draft") {
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
      <AppShell
        title="Check this is right"
        onBack={() => {
          setDraft(null);
          setPhase("idle");
        }}
      >
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          <p className="text-lg font-bold text-muted-foreground">I captured:</p>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-2xl font-black leading-tight break-words">
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
            {draft.suspected_cause ? (
              <CardLine label="Suspected cause" value={draft.suspected_cause} />
            ) : null}
            {draft.verified_cause ? (
              <CardLine label="Verified cause" value={draft.verified_cause} />
            ) : null}
            {draft.action_taken ? (
              <CardLine label="Action taken" value={draft.action_taken} />
            ) : null}
            {draft.severity ? (
              <CardLine label="Severity" value={draft.severity} />
            ) : null}
            {draft.transcript ? (
              <div className="max-h-48 overflow-y-auto rounded-xl bg-secondary p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Transcript
                </p>
                <p className="mt-1 text-base italic leading-snug break-words">"{draft.transcript}"</p>
              </div>
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
            <button
              type="button"
              onClick={() => setPhase("edit")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary font-bold"
            >
              <Pencil className="size-5" /> Edit
            </button>
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
          <Stat value={unresolvedCount(state)} label="open" warn />
        </div>

        {micBlocked ? (
          <div className="w-full rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-base font-medium text-warning break-words">
              Microphone not available. Use Manual entry below to log events, or allow mic access and refresh.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-5">
          <button
            ref={buttonRef}
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={processing || micBlocked}
            className={`flex size-56 flex-col items-center justify-center gap-2 rounded-full text-record-foreground transition-transform active:scale-95 ${
              recording ? "bg-record" : "bg-record"
            } ${processing || micBlocked ? "opacity-40" : ""}`}
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
                ? "Transcribing…"
                : micBlocked
                  ? "Use Manual entry below to log events"
                  : "Tap once, speak one event."}
          </p>
          {recording && liveTranscript ? (
            <div className="max-h-32 w-full overflow-y-auto rounded-xl bg-secondary p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Live preview
              </p>
              <p className="mt-1 text-sm italic leading-snug break-words">"{liveTranscript}"</p>
            </div>
          ) : null}
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
      <p className="text-lg leading-snug break-words">{value}</p>
    </div>
  );
}
