import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleCheck, Loader2, Plus, Search, X, Wrench } from "lucide-react";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { PlanMaintenanceDialog } from "@/components/shift/PlanMaintenanceDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_LABEL } from "@/lib/ops-model";
import { ApiError } from "@/lib/api";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import {
  useActionsByType,
  useAddAILesson,
  useApproveShiftReport,
  useConfirmEvent,
  useCreateRCAFromEvent,
  useEvents,
  useLessonsToReview,
  usePlanMaintenance,
  useRejectAILesson,
  useReportApprovals,
  useResolveEvent,
  useVerifyAILesson,
  type EventRow,
} from "@/lib/hooks";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Still on the supervisor's desk: not resolved, not handed to maintenance. */
const UNRESOLVED = new Set(["draft", "confirmed", "investigating", "open", "escalated"]);

const LESSON_KINDS = [
  { value: "term", label: "Term" },
  { value: "mishearing", label: "Mishearing" },
  { value: "field_correction", label: "Field correction" },
  { value: "classification", label: "Classification" },
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  LESSON_KINDS.map((k) => [k.value, k.label]),
);

const SOURCE_LABEL: Record<string, string> = {
  human_edit: "human edit",
  ai_suggest: "AI suggestion",
  dual_transcript: "two transcripts agree",
  onboarding: "onboarding",
  external: "external source",
};

export const Route = createFileRoute("/console/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "End-of-shift reports waiting for sign-off, events needing confirmation or resolution, breakdowns ready for maintenance or RCA, and vocabulary corrections the AI is proposing.",
      },
      { property: "og:title", content: "Approvals | OptiLog" },
      { property: "og:description", content: "One queue for every decision a supervisor owes." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const navigate = useNavigate();
  const isSupervisor = hasMinRole(user?.role ?? "operator", "supervisor");

  const reports = useReportApprovals(plantId, isSupervisor);
  const events = useEvents(plantId, todayStr(), { limit: 200 });
  const actions = useActionsByType(plantId, "maintenance_intervention", isSupervisor);
  const review = useLessonsToReview(plantId, isSupervisor);

  const approveReport = useApproveShiftReport();
  const confirmEvent = useConfirmEvent();
  const resolveEvent = useResolveEvent();
  const createRCA = useCreateRCAFromEvent();
  const planMaintenance = usePlanMaintenance();
  const verifyLesson = useVerifyAILesson();
  const rejectLesson = useRejectAILesson();
  const addLesson = useAddAILesson(plantId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [planRow, setPlanRow] = useState<EventRow | null>(null);
  const [planDate, setPlanDate] = useState(todayStr());
  const [planNotes, setPlanNotes] = useState("");
  // Vocabulary: inline "add term" form + a reject that must be armed first.
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonKind, setLessonKind] = useState<string>("term");
  const [lessonTrigger, setLessonTrigger] = useState("");
  const [lessonCorrection, setLessonCorrection] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  if (!plantId) {
    return (
      <ConsoleShell title="Approvals" subtitle="Everything waiting on a supervisor decision">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }
  if (!isSupervisor) {
    return (
      <ConsoleShell title="Approvals" subtitle="Everything waiting on a supervisor decision">
        <p className="text-muted-foreground">Approvals are handled by supervisors and above.</p>
      </ConsoleShell>
    );
  }

  const fail = (err: unknown) =>
    setActionError(err instanceof ApiError || err instanceof Error ? err.message : "Action failed");

  const allEvents = events.data ?? [];
  const unresolved = allEvents.filter((e) => UNRESOLVED.has(e.status));
  const pendingReports = (reports.data ?? []).filter((r) => !r.report_approved_at);

  const actionList = Array.isArray(actions.data) ? actions.data : (actions.data?.items ?? []);
  const plannedEventIds = new Set(
    actionList.map((a) => a.event_id).filter((id): id is string => !!id),
  );

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setActionError(null);
    setPendingId(id);
    try {
      await fn();
    } catch (err) {
      fail(err);
    } finally {
      setPendingId(null);
    }
  };

  const reportRows = reports.data ?? [];

  return (
    <ConsoleShell
      title="Approvals"
      subtitle="Reports, event sign-offs, maintenance pushes and vocabulary review"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shift reports pending"
          value={pendingReports.length}
          hint={reportRows.length ? "Ended shifts awaiting sign-off" : "No ended shifts yet"}
          tone={pendingReports.length ? "warning" : "default"}
        />
        <StatCard
          label="Events needing action"
          value={unresolved.length}
          hint="Today, still unresolved"
          tone={unresolved.length ? "warning" : "default"}
        />
        <StatCard
          label="Pushed to maintenance"
          value={plannedEventIds.size}
          hint="Already scheduled"
        />
        <StatCard
          label="Vocabulary to review"
          value={review.total}
          hint={review.total ? "AI lessons awaiting a decision" : "Nothing waiting"}
          tone={review.total ? "warning" : "default"}
        />
      </div>

      {actionError ? (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {actionError}
        </div>
      ) : null}

      {/* --------------------------- shift reports --------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Shift reports
        </h2>
        {reports.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : reportRows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No shifts have ended yet today.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Shift</th>
                  <th className="px-4 py-2 text-left font-medium">Team</th>
                  <th className="px-4 py-2 text-left font-medium">Ended</th>
                  <th className="px-4 py-2 text-left font-medium">Events / open</th>
                  <th className="px-4 py-2 text-left font-medium">Handover</th>
                  <th className="px-4 py-2 text-right font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r) => {
                  const approved = !!r.report_approved_at;
                  return (
                    <tr key={r.id} className="border-b border-border/60 align-top">
                      <td className="px-4 py-3 font-medium capitalize">
                        {r.shift_type} · {r.date}
                        <p className="mt-0.5 text-xs font-normal capitalize text-muted-foreground">
                          {r.status.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.team_name || "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {r.actual_end ? r.actual_end.slice(11, 16) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.event_count} / {r.open_issues} open
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                        <span className="line-clamp-3 whitespace-pre-line">
                          {r.handover_notes || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {approved ? (
                          <button
                            type="button"
                            disabled={pendingId === r.id || approveReport.isPending}
                            onClick={() =>
                              run(r.id, async () => {
                                await approveReport.mutateAsync({ shiftId: r.id, approve: false });
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-bold text-success disabled:opacity-50"
                          >
                            <CircleCheck className="size-3.5" /> Approved · undo
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingId === r.id || approveReport.isPending}
                            onClick={() =>
                              run(r.id, async () => {
                                await approveReport.mutateAsync({ shiftId: r.id, approve: true });
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                          >
                            {pendingId === r.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : null}
                            Approve report
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --------------------------- vocabulary --------------------------- */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Vocabulary the AI is learning
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Mishearings and corrections spotted in your transcripts. Verified entries steer every
              future transcription; rejected ones never do.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLessonFormOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary/60"
          >
            {lessonFormOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {lessonFormOpen ? "Close" : "Add term"}
          </button>
        </div>

        {lessonFormOpen ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const correction = lessonCorrection.trim();
              const trigger = lessonTrigger.trim();
              if (!correction) return;
              if (lessonKind !== "term" && !trigger) return;
              setActionError(null);
              try {
                await addLesson.mutateAsync({
                  kind: lessonKind,
                  correction,
                  ...(lessonKind === "term" ? { trigger: correction } : { trigger }),
                });
                setLessonTrigger("");
                setLessonCorrection("");
                setLessonFormOpen(false);
              } catch (err) {
                fail(err);
              }
            }}
            className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor="lesson-kind">Kind</Label>
              <select
                id="lesson-kind"
                value={lessonKind}
                onChange={(e) => setLessonKind(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LESSON_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="lesson-correction">Correction (what it should say)</Label>
              <Input
                id="lesson-correction"
                value={lessonCorrection}
                onChange={(e) => setLessonCorrection(e.target.value)}
                placeholder="e.g. pulp"
                required
                className="mt-1"
              />
            </div>
            {lessonKind !== "term" ? (
              <div className="sm:col-span-2">
                <Label htmlFor="lesson-trigger">Heard (the wrong word or phrase)</Label>
                <Input
                  id="lesson-trigger"
                  value={lessonTrigger}
                  onChange={(e) => setLessonTrigger(e.target.value)}
                  placeholder="e.g. pork"
                  required
                  className="mt-1"
                />
              </div>
            ) : null}
            <div className="flex justify-end sm:col-span-2">
              <button
                type="submit"
                disabled={addLesson.isPending || !lessonCorrection.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {addLesson.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save correction
              </button>
            </div>
          </form>
        ) : null}

        {review.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : review.items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing waiting — the AI hasn't proposed any corrections.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {review.items.map((lesson) => {
              const trigger =
                typeof lesson.trigger === "object" && lesson.trigger
                  ? (lesson.trigger.text ?? "")
                  : "";
              const showTrigger =
                lesson.kind !== "term" && trigger && trigger !== lesson.correction;
              const ineffective = lesson.status === "ineffective";
              return (
                <div
                  key={lesson.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold break-words">
                      {showTrigger ? (
                        <>
                          <span className="text-muted-foreground line-through">{trigger}</span>
                          <span className="mx-2 text-muted-foreground">→</span>
                        </>
                      ) : null}
                      <span className="font-mono">{lesson.correction}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {KIND_LABEL[lesson.kind] ?? lesson.kind} · heard{" "}
                      <span className="font-medium">{lesson.hits ?? 1}</span>× ·{" "}
                      {SOURCE_LABEL[lesson.source] ?? lesson.source}
                      {lesson.last_seen_at ? ` · last ${lesson.last_seen_at.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={
                        ineffective
                          ? "rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase text-muted-foreground"
                          : "rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-bold uppercase text-warning"
                      }
                      title={
                        ineffective
                          ? "Kept being wrong — dropped from the AI prompts until re-verified"
                          : "The AI proposed this; it is not applied until verified"
                      }
                    >
                      {ineffective ? "Stopped helping" : "Needs review"}
                    </span>
                    <button
                      type="button"
                      disabled={pendingId === lesson.id}
                      onClick={() =>
                        run(lesson.id, async () => {
                          await verifyLesson.mutateAsync(lesson.id);
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-bold text-success disabled:opacity-50"
                    >
                      {pendingId === lesson.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CircleCheck className="size-3.5" />
                      )}
                      {ineffective ? "Re-verify" : "Verify"}
                    </button>
                    {rejectingId === lesson.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary/60"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === lesson.id}
                          onClick={() =>
                            run(lesson.id, async () => {
                              setRejectingId(null);
                              await rejectLesson.mutateAsync(lesson.id);
                            })
                          }
                          className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50"
                        >
                          Reject forever
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRejectingId(lesson.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary/60 disabled:opacity-50"
                        disabled={pendingId === lesson.id}
                      >
                        <X className="size-3.5" /> Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------- events to action ------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Today's events waiting on you
        </h2>
        {events.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : unresolved.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Every event today is resolved.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {unresolved.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{e.description || e.observation}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.timestamp.slice(11, 16)} · {e.line_name} · {e.asset_name} ·{" "}
                    <span className="font-medium capitalize">
                      {STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}
                    </span>
                    {e.severity ? ` · ${e.severity}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {e.status === "draft" ? (
                    <button
                      type="button"
                      disabled={pendingId === e.id}
                      onClick={() =>
                        run(e.id, async () => {
                          await confirmEvent.mutateAsync({ eventId: e.id });
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary/60 disabled:opacity-50"
                    >
                      {pendingId === e.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CircleCheck className="size-3.5" />
                      )}
                      Confirm
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={pendingId === e.id}
                    onClick={() =>
                      run(e.id, async () => {
                        await resolveEvent.mutateAsync({ eventId: e.id });
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-bold text-success disabled:opacity-50"
                  >
                    <CircleCheck className="size-3.5" /> Resolve
                  </button>

                  <button
                    type="button"
                    disabled={plannedEventIds.has(e.id)}
                    onClick={() => {
                      setPlanRow(e);
                      setPlanDate(todayStr());
                      setPlanNotes("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning disabled:opacity-50"
                    title={plannedEventIds.has(e.id) ? "Already pushed to maintenance" : undefined}
                  >
                    <Wrench className="size-3.5" />
                    {plannedEventIds.has(e.id) ? "Planned" : "Push to maintenance"}
                  </button>

                  {e.event_type === "breakdown" && !e.incident_id ? (
                    <button
                      type="button"
                      disabled={pendingId === e.id || createRCA.isPending}
                      onClick={() =>
                        run(e.id, async () => {
                          const rca = await createRCA.mutateAsync({ eventId: e.id });
                          await navigate({
                            to: "/console/rca",
                            search: { incident: rca.incident_id },
                          });
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-bold text-info disabled:opacity-50"
                    >
                      <Search className="size-3.5" /> Start RCA
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {planRow ? (
        <PlanMaintenanceDialog
          issue={{
            title: planRow.description || planRow.observation || planRow.event_type,
            subtitle: `${planRow.asset_name} · ${planRow.severity}`,
          }}
          date={planDate}
          notes={planNotes}
          onDateChange={setPlanDate}
          onNotesChange={setPlanNotes}
          isPending={planMaintenance.isPending}
          error={planMaintenance.error instanceof Error ? planMaintenance.error.message : null}
          onCancel={() => setPlanRow(null)}
          onConfirm={async () => {
            setActionError(null);
            try {
              await planMaintenance.mutateAsync({
                shiftId: planRow.shift_id,
                eventId: planRow.id,
                plantId,
                plannedDate: planDate,
                notes: planNotes,
                assignedTeam: "",
              });
              setPlanRow(null);
            } catch (err) {
              fail(err);
            }
          }}
        />
      ) : null}
    </ConsoleShell>
  );
}
