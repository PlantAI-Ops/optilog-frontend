import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, CircleCheck, CircleDot, Loader2, Pencil, Play } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { EventEditor } from "@/components/shift/EventEditor";
import { useEventAudio, useMyEvents } from "@/lib/hooks";
import {
  STATUS_LABEL,
  formatTime,
  hasMinRole,
  mergeEvents,
  updateEvent,
  useShiftLog,
  type ShiftEvent,
} from "@/lib/shift-log";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Shift timeline — Shift-Log" },
      {
        name: "description",
        content: "Chronological record of this shift's events, transcripts and resolution status.",
      },
      { property: "og:title", content: "Shift timeline — Shift-Log" },
      {
        property: "og:description",
        content: "Every logged event with its transcript, causes and status.",
      },
    ],
  }),
  component: TimelinePage,
});

function statusIcon(status: ShiftEvent["status"]) {
  if (status === "resolved") return <CircleCheck className="size-5 text-success" />;
  if (status === "investigating") return <CircleDot className="size-5 text-warning" />;
  if (status === "confirmed") return <CircleDot className="size-5 text-primary" />;
  return <CircleDot className="size-5 text-muted-foreground" />;
}

function TimelinePage() {
  const state = useShiftLog();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");

  const plantId = state.user?.plant_ids?.[0];
  const today = new Date().toISOString().slice(0, 10);
  const myEvents = useMyEvents(plantId, today);

  useEffect(() => {
    if (myEvents.data) {
      mergeEvents(myEvents.data);
    }
  }, [myEvents.data]);

  const editing = state.events.find((e) => e.id === editId);
  if (editing) {
    return (
      <AppShell title="Edit event">
        <EventEditor
          event={editing}
          onCancel={() => setEditId(null)}
          onSave={(e) => {
            updateEvent(e.id, e);
            setEditId(null);
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={`${state.shiftName} · ${state.line}`}>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Shift timeline</h1>
          <span className="text-sm font-bold text-muted-foreground">
            {isSupervisor ? "All operators" : "Your entries"}
          </span>
        </div>

        {state.startedAt ? <Row time={formatTime(state.startedAt)} title="Shift started" /> : null}

        {state.events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
            No events yet. Tap RECORD on the home screen to log one.
          </p>
        ) : null}

        {state.events.map((event) => {
          const open = openId === event.id;
          return (
            <div key={event.id} className="rounded-2xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : event.id)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                <span className="text-lg font-black tabular-nums">
                  {formatTime(event.timestamp)}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold leading-tight">
                    {event.event_type || "Untitled event"}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {event.asset}
                    {event.duration_minutes !== null ? ` · ${event.duration_minutes} min` : ""}
                    {event.sync === "pending" ? " · pending sync" : ""}
                  </span>
                </span>
                {statusIcon(event.status)}
                <ChevronDown
                  className={`size-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open ? (
                <div className="space-y-3 border-t border-border px-4 py-4">
                  <Detail label="Status" value={STATUS_LABEL[event.status]} />
                  {event.subsystem ? <Detail label="Subsystem" value={event.subsystem} /> : null}
                  <Detail label="Observation" value={event.observation || "—"} />
                  <Detail label="Reported cause" value={event.reported_cause || "—"} />
                  {event.suspected_cause ? (
                    <Detail label="Suspected cause" value={event.suspected_cause} />
                  ) : null}
                  <Detail label="Verified cause" value={event.verified_cause || "Not verified"} />
                  <Detail label="Action taken" value={event.action_taken || "—"} />
                  <Detail label="Logged by" value={`${event.logged_by} · ${event.source}`} />
                  {event.transcript ? (
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-secondary p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Original transcript
                      </p>
                      <p className="mt-1 text-base italic leading-snug break-words">"{event.transcript}"</p>
                      {event.recording_id ? (
                        <PlayAudioButton
                          shiftId={state.shiftId ?? undefined}
                          eventId={event.id}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {isSupervisor ? (
                    <button
                      type="button"
                      onClick={() => setEditId(event.id)}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground"
                    >
                      <Pencil className="size-5" /> Edit event
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        <Link
          to="/"
          className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground"
        >
          Back to recording
        </Link>
      </div>
    </AppShell>
  );
}

function PlayAudioButton({ shiftId, eventId }: { shiftId: string | undefined; eventId: string }) {
  const audioQuery = useEventAudio(shiftId, eventId);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    const url = audioQuery.data?.audio_url;
    if (!url) return;
    const audio = new Audio(url);
    audio.onended = () => {
      setPlaying(false);
      audioRef.current = null;
    };
    audio.play();
    audioRef.current = audio;
    setPlaying(true);
  };

  if (!audioQuery.data?.audio_url && !audioQuery.isLoading) return null;

  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={audioQuery.isLoading}
      className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card font-bold disabled:opacity-60"
    >
      {audioQuery.isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Play className="size-5" />
      )}
      {playing ? "Pause audio" : "Play audio"}
    </button>
  );
}

function Row({ time, title }: { time: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-lg font-black tabular-nums">{time}</span>
      <span className="text-lg font-bold text-muted-foreground">{title}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base leading-snug break-words">{value}</p>
    </div>
  );
}
