import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Loader2, Mic } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { EventEditor } from "@/components/shift/EventEditor";
import {
  PlanMaintenanceDialog,
  type PlanMaintenanceIssue,
} from "@/components/shift/PlanMaintenanceDialog";
import { TimelineEventRow } from "@/components/shift/TimelineEvent";
import { usePlanMaintenance, useShiftAISummary } from "@/lib/hooks";
import { useShiftWindow } from "@/hooks/use-shift-window";
import {
  canLogShift,
  deleteEvent,
  endShift,
  hasMinRole,
  saveEvent,
  unresolvedCount,
  useShiftLog,
  type ShiftEvent,
} from "@/lib/shift-log";

export const Route = createFileRoute("/end-shift")({
  head: () => ({
    meta: [
      { title: "End shift & handover — OptiLog" },
      {
        name: "description",
        content:
          "Close out the shift with an AI summary of the events and a handover note for the next crew.",
      },
      { property: "og:title", content: "End shift & handover — OptiLog" },
      {
        property: "og:description",
        content: "Shift totals, the AI summary and the handover note in two quick steps.",
      },
    ],
  }),
  component: EndShiftPage,
});

function EndShiftPage() {
  const state = useShiftLog();
  const navigate = useNavigate();
  const [note, setNote] = useState(state.handover);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [planEventId, setPlanEventId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planNotes, setPlanNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  /** Step 1 reviews the shift + AI summary; step 2 is the handover note. */
  const [step, setStep] = useState<"review" | "handover">("review");
  const [summary, setSummary] = useState<{ text: string; source: string } | null>(null);
  const [showEvents, setShowEvents] = useState(false);
  const unresolved = unresolvedCount(state);
  const resolved = state.events.filter((e) => e.status === "resolved").length;
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");
  const userId = state.user?.id ?? null;
  const planMaintenance = usePlanMaintenance();
  const aiSummary = useShiftAISummary();
  const shiftWindow = useShiftWindow(state.windowEnd);

  // Part of the voice logging flow — shift_manager+ belongs on the manager home.
  const canLog = canLogShift(state.user?.role);
  useEffect(() => {
    if (state.user && !canLog) navigate({ to: "/", replace: true });
  }, [state.user, canLog, navigate]);
  if (state.user && !canLog) return null;

  const canManage = (event: ShiftEvent) =>
    isSupervisor || (!!userId && event.operator_id === userId);

  const editing = state.events.find((e) => e.id === editId);
  if (editing) {
    return (
      <AppShell title="Edit event">
        <EventEditor
          event={editing}
          onCancel={() => setEditId(null)}
          onSave={(e) => {
            setActionError(null);
            void saveEvent(e.id, e).catch((err: unknown) =>
              setActionError(err instanceof Error ? err.message : "Could not save the event."),
            );
            setEditId(null);
          }}
        />
      </AppShell>
    );
  }

  const planEvent = planEventId ? state.events.find((e) => e.id === planEventId) : null;
  const issue: PlanMaintenanceIssue | null = planEvent
    ? {
        title: planEvent.observation || planEvent.event_type,
        subtitle: `${planEvent.asset} · ${planEvent.severity}`,
      }
    : null;

  /** Same shape as the backend's deterministic fallback, for offline shifts. */
  const localSummaryText = () => {
    const open = state.events.filter((e) => e.status !== "resolved");
    const lines = [
      `${state.events.length} event(s) logged: ${state.events.length - open.length} resolved, ${open.length} still open.`,
    ];
    if (open.length) {
      lines.push("", "Still open:");
      for (const e of open.slice(0, 10)) {
        lines.push(`- ${e.observation || e.event_type}${e.asset ? ` · ${e.asset}` : ""}`);
      }
    }
    return lines.join("\n");
  };

  // Step 1 -> 2: fetch (or reuse) the AI summary before the handover screen.
  const handleReviewEnd = async () => {
    setActionError(null);
    if (!state.shiftId) {
      setSummary({ text: localSummaryText(), source: "local" });
      setStep("handover");
      return;
    }
    try {
      const res = await aiSummary.mutateAsync({ shiftId: state.shiftId });
      setSummary({ text: res.summary, source: res.source });
    } catch {
      // Transport/permission failure only — never block the handover on AI.
      setSummary({ text: localSummaryText(), source: "local" });
    }
    setStep("handover");
  };

  // Step 2 -> done: the actual handover.
  const handleConfirm = async () => {
    setActionError(null);
    try {
      await endShift(note);
      // The timeline is the post-shift home: full event list, summary card,
      // and the report behind a single link.
      navigate({ to: "/timeline" });
    } catch {
      // error is set in state by endShift()
    }
  };

  const eventRows =
    state.events.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        No events were logged this shift.
      </p>
    ) : (
      state.events.map((event) => (
        <TimelineEventRow
          key={event.id}
          event={event}
          open={openId === event.id}
          onToggle={() => setOpenId(openId === event.id ? null : event.id)}
          shiftId={state.shiftId ?? undefined}
          canEdit={canManage(event)}
          canDelete={canManage(event)}
          canPlanMaintenance={isSupervisor}
          onEdit={() => {
            setActionError(null);
            setEditId(event.id);
          }}
          onDelete={() => {
            setActionError(null);
            void deleteEvent(event.id).catch((err: unknown) =>
              setActionError(err instanceof Error ? err.message : "Could not delete the event."),
            );
          }}
          onPlanMaintenance={() => {
            setPlanDate(new Date().toISOString().slice(0, 10));
            setPlanNotes("");
            setPlanEventId(event.id);
          }}
        />
      ))
    );

  return (
    <AppShell title="End of shift">
      <div className="flex flex-1 flex-col gap-5">
        <h1 className="text-2xl font-black">
          {step === "review" ? "Shift summary" : "Hand over the shift"}
        </h1>

        {shiftWindow.over ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-base font-medium text-warning">
            The shift window has closed. End the shift to hand over — recording is off.
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <Tile value={state.events.length} label="events" />
          <Tile value={resolved} label="resolved" tone="success" />
          <Tile value={unresolved} label="unresolved" tone="warning" />
        </div>

        {step === "review" ? (
          <div>
            <p className="text-lg font-bold">Everything logged this shift</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fix or remove bad transcriptions here before you hand over.
            </p>
            <div className="mt-3 space-y-3">{eventRows}</div>
          </div>
        ) : (
          <>
            {summary ? (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Shift summary
                  </p>
                  <span
                    className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-bold uppercase text-muted-foreground"
                    title={
                      summary.source === "llm"
                        ? "Written by the shift AI from this shift's events"
                        : "Draft from the shift totals — review before handing over"
                    }
                  >
                    {summary.source === "llm" ? "AI" : "Draft"}
                  </span>
                </div>
                <p className="mt-2 text-base whitespace-pre-line">{summary.text}</p>
              </div>
            ) : null}

            <div>
              <button
                type="button"
                onClick={() => setShowEvents((v) => !v)}
                aria-expanded={showEvents}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-base font-bold"
              >
                View each logged event ({state.events.length})
                <ChevronDown
                  className={`size-5 shrink-0 transition-transform ${showEvents ? "rotate-180" : ""}`}
                />
              </button>
              {showEvents ? <div className="mt-3 space-y-3">{eventRows}</div> : null}
            </div>

            <div>
              <p className="text-lg font-bold">Anything the next shift needs to know?</p>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Handover note…"
                className="mt-2 max-h-40 w-full resize-none overflow-y-auto rounded-2xl border border-input bg-secondary p-4 text-base outline-none focus:border-ring"
              />
              <button
                type="button"
                onClick={() =>
                  setNote((n) => (n ? n : "Watch the Line 3 motor noise — maintenance is aware."))
                }
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold"
              >
                <Mic className="size-5" /> Dictate note
              </button>
            </div>
          </>
        )}

        {state.error || actionError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive break-words">
            {actionError ?? state.error}
          </div>
        ) : null}

        {!isSupervisor && step === "handover" ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-base font-medium text-warning">
            Ending the shift sends it for supervisor approval.
          </p>
        ) : null}

        <div className="mt-auto space-y-3">
          {state.endedAt ? (
            <>
              <Link
                to="/timeline"
                className="flex h-20 w-full items-center justify-center rounded-3xl bg-primary text-xl font-black text-primary-foreground"
              >
                View shift timeline
              </Link>
              <Link
                to="/report"
                className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-secondary font-bold"
              >
                Open report
              </Link>
            </>
          ) : step === "review" ? (
            <>
              <button
                type="button"
                onClick={handleReviewEnd}
                disabled={aiSummary.isPending}
                className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-xl font-black text-primary-foreground disabled:opacity-60"
              >
                {aiSummary.isPending ? <Loader2 className="size-5 animate-spin" /> : null}
                {aiSummary.isPending ? "Writing shift summary…" : "End Shift"}
              </button>
              <Link
                to="/"
                className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-secondary font-bold"
              >
                Not yet — back to shift
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={state.loading}
                className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-xl font-black text-primary-foreground disabled:opacity-60"
              >
                {state.loading ? <Loader2 className="size-5 animate-spin" /> : null}
                Confirm &amp; hand over
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-secondary font-bold"
                >
                  Back to summary
                </button>
                <Link
                  to="/"
                  className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-secondary font-bold"
                >
                  Not yet — back to shift
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {planEvent && issue ? (
        <PlanMaintenanceDialog
          issue={issue}
          date={planDate}
          notes={planNotes}
          onDateChange={setPlanDate}
          onNotesChange={setPlanNotes}
          onConfirm={async () => {
            try {
              await planMaintenance.mutateAsync({
                shiftId: state.shiftId ?? "",
                eventId: planEvent.id,
                plantId: state.user?.plant_ids?.[0] ?? "",
                plannedDate: planDate,
                notes: planNotes,
                assignedTeam: "",
              });
              await saveEvent(planEvent.id, { status: "planned_maintenance" });
              setPlanEventId(null);
            } catch (err: unknown) {
              if (err instanceof Error) setActionError(err.message);
            }
          }}
          onCancel={() => setPlanEventId(null)}
          isPending={planMaintenance.isPending}
          error={planMaintenance.error instanceof Error ? planMaintenance.error.message : null}
        />
      ) : null}
    </AppShell>
  );
}

function Tile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "success" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning" && value > 0
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-4 text-center">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
