import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, CircleCheck, CircleDot, CircleAlert, Pencil, Play } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { EventEditor } from "@/components/shift/EventEditor";
import {
  STATUS_LABEL,
  formatTime,
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
  if (status === "unresolved") return <CircleAlert className="size-5 text-destructive" />;
  return <CircleDot className="size-5 text-warning" />;
}

function TimelinePage() {
  const state = useShiftLog();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const isSupervisor = state.user?.role === "supervisor";

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
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Shift timeline</h1>
          <span className="text-sm font-bold text-muted-foreground">
            {isSupervisor ? "All operators" : "Your entries"}
          </span>
        </div>

        {state.startedAt ? (
          <Row time={formatTime(state.startedAt)} title="Shift started" />
        ) : null}

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
                <span className="text-lg font-black tabular-nums">{formatTime(event.timestamp)}</span>
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
                  <Detail label="Verified cause" value={event.verified_cause || "Not verified"} />
                  <Detail label="Action taken" value={event.action_taken || "—"} />
                  <Detail label="Logged by" value={`${event.logged_by} · ${event.source}`} />
                  {event.transcript ? (
                    <div className="rounded-xl bg-secondary p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Original transcript
                      </p>
                      <p className="mt-1 text-base italic leading-snug">"{event.transcript}"</p>
                      <button
                        type="button"
                        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card font-bold"
                      >
                        <Play className="size-5" /> Play audio
                      </button>
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
      <p className="text-base leading-snug">{value}</p>
    </div>
  );
}