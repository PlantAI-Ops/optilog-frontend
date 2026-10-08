import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/shift/AppShell";
import { EventEditor } from "@/components/shift/EventEditor";
import {
  PlanMaintenanceDialog,
  type PlanMaintenanceIssue,
} from "@/components/shift/PlanMaintenanceDialog";
import { TimelineEventRow } from "@/components/shift/TimelineEvent";
import { useApproveShiftReport, useMyEvents, usePlanMaintenance, useShift } from "@/lib/hooks";
import { useShiftWindow } from "@/hooks/use-shift-window";
import {
  approveReport,
  canLogShift,
  deleteEvent,
  formatTime,
  hasMinRole,
  mergeEvents,
  saveEvent,
  unresolvedCount,
  useShiftLog,
  type ShiftEvent,
} from "@/lib/shift-log";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Shift timeline — OptiLog" },
      {
        name: "description",
        content: "Chronological record of this shift's events, transcripts and resolution status.",
      },
      { property: "og:title", content: "Shift timeline — OptiLog" },
      {
        property: "og:description",
        content: "Every logged event with its transcript, causes and status.",
      },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const state = useShiftLog();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [planEventId, setPlanEventId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planNotes, setPlanNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");
  const userId = state.user?.id ?? null;
  const planMaintenance = usePlanMaintenance();
  const shiftWindow = useShiftWindow(state.windowEnd);

  const plantId = state.user?.plant_ids?.[0];
  const today = new Date().toISOString().slice(0, 10);
  const myEvents = useMyEvents(plantId, today);

  useEffect(() => {
    if (myEvents.data) {
      mergeEvents(myEvents.data);
    }
  }, [myEvents.data]);

  // Part of the voice logging flow — shift_manager+ belongs on the manager home.
  const canLog = canLogShift(state.user?.role);
  useEffect(() => {
    if (state.user && !canLog) navigate({ to: "/", replace: true });
  }, [state.user, canLog, navigate]);
  if (state.user && !canLog) return null;

  /** Edit and delete: the event's owner or any supervisor (matches the API). */
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
        {actionError ? (
          <p className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive break-words">
            {actionError}
          </p>
        ) : null}
      </AppShell>
    );
  }

  const planEvent = planEventId ? state.events.find((e) => e.id === planEventId) : null;
  const ended = !!state.endedAt;
  const windowOver = shiftWindow.over;
  const resumeAvailable = ended && !windowOver;

  const issue: PlanMaintenanceIssue | null = planEvent
    ? {
        title: planEvent.observation || planEvent.event_type,
        subtitle: `${planEvent.asset} · ${planEvent.severity}`,
      }
    : null;

  return (
    <AppShell title={`${state.shiftName} · ${state.line}`}>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Shift timeline</h1>
          <span className="text-sm font-bold text-muted-foreground">
            {isSupervisor ? "All operators" : "Your entries"}
          </span>
        </div>

        {ended ? <ShiftSummaryCard /> : null}

        {state.startedAt ? <Row time={formatTime(state.startedAt)} title="Shift started" /> : null}

        {state.events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
            No events yet. Tap RECORD on the home screen to log one.
          </p>
        ) : null}

        {state.events.map((event) => (
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
        ))}

        {actionError ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive break-words">
            {actionError}
          </p>
        ) : null}

        <FooterCta ended={ended} resumeAvailable={resumeAvailable} windowOver={windowOver} />

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
                  plantId: plantId ?? "",
                  plannedDate: planDate,
                  notes: planNotes,
                  assignedTeam: "",
                });
                await saveEvent(planEvent.id, { status: "planned_maintenance" });
                setPlanEventId(null);
              } catch (err: unknown) {
                // Dialog keeps itself open and shows the reason.
                if (err instanceof Error) {
                  // mutateAsync rejects with the API error; surface it below.
                  planMaintenance.reset();
                  setActionError(err.message);
                }
              }
            }}
            onCancel={() => setPlanEventId(null)}
            isPending={planMaintenance.isPending}
            error={planMaintenance.error instanceof Error ? planMaintenance.error.message : null}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

/**
 * Everything the shift produced, shown once the shift is over — counts, the
 * handover note and the report approval state, without leaving the timeline.
 */
function ShiftSummaryCard() {
  const state = useShiftLog();
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");
  const resolved = state.events.filter((e) => e.status === "resolved").length;
  const shift = useShift(state.shiftId ?? undefined);
  const approved = !!shift.data?.report_approved_at || state.reportApproved;

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">Shift summary</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
            approved ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
          }`}
        >
          {approved ? "Report approved" : "Awaiting report approval"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SummaryTile value={state.events.length} label="events" />
        <SummaryTile value={resolved} label="resolved" tone="text-success" />
        <SummaryTile value={unresolvedCount(state)} label="unresolved" tone="text-warning" />
      </div>
      {state.handover ? (
        <div className="mt-3 rounded-xl bg-secondary p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Handover note
          </p>
          <p className="mt-1 text-sm leading-snug break-words">{state.handover}</p>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Link
          to="/report"
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card text-sm font-bold"
        >
          Open report
        </Link>
        {isSupervisor && !approved ? <ApproveReportButton shiftId={state.shiftId} /> : null}
      </div>
    </section>
  );
}

function ApproveReportButton({ shiftId }: { shiftId: string | null }) {
  const approve = useApproveShiftReport();

  return (
    <div className="flex-1">
      <button
        type="button"
        disabled={!shiftId || approve.isPending}
        onClick={() =>
          shiftId &&
          approve.mutate(
            { shiftId, approve: true },
            {
              onSuccess: () => approveReport(),
            },
          )
        }
        className="h-11 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-60"
      >
        {approve.isPending ? "Approving…" : "Approve report"}
      </button>
      {approve.error ? (
        <p className="mt-1 text-xs font-medium text-destructive break-words">
          {approve.error instanceof Error ? approve.error.message : "Could not approve."}
        </p>
      ) : null}
    </div>
  );
}

function SummaryTile({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-card px-2 py-3 text-center">
      <p className={`text-2xl font-black ${tone ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Recording is only offered while the shift is actually still running. */
function FooterCta({
  ended,
  resumeAvailable,
  windowOver,
}: {
  ended: boolean;
  resumeAvailable: boolean;
  windowOver: boolean;
}) {
  if (!ended) {
    return (
      <Link
        to="/"
        className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground"
      >
        Back to recording
      </Link>
    );
  }
  if (resumeAvailable) {
    return (
      <Link
        to="/"
        className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl border-2 border-primary bg-card text-lg font-black text-primary"
      >
        Resume logging — shift still running
      </Link>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <p className="rounded-2xl border border-border bg-secondary p-4 text-center text-base font-medium">
        {windowOver
          ? "The shift window has closed — recording is off until your next shift."
          : "This shift has ended."}
      </p>
      <Link
        to="/report"
        className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-card font-bold"
      >
        View shift report
      </Link>
    </div>
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
