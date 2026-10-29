import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, CircleCheck, Loader2, Search, Wrench } from "lucide-react";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { PlanMaintenanceDialog } from "@/components/shift/PlanMaintenanceDialog";
import { STATUS_LABEL, UNRESOLVED_STATUSES, todayStr } from "@/lib/ops-model";
import { ApiError } from "@/lib/api";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import {
  useActionsByType,
  useApproveShiftReport,
  useConfirmEvent,
  useCreateRCAFromEvent,
  useEvents,
  usePlanMaintenance,
  useReportApprovals,
  useResolveEvent,
  type EventRow,
  type ReportApprovalRow,
} from "@/lib/hooks";

/** One row per line: every report the queue could place on a line. */
interface LineGroup {
  key: string;
  area: string;
  line: string;
  rows: ReportApprovalRow[];
}

function groupReportRows(rows: ReportApprovalRow[]): LineGroup[] {
  const byKey = new Map<string, LineGroup>();
  for (const r of rows) {
    const area = r.area_name?.trim() || "Unassigned area";
    const line = r.line_name?.trim() || "Unassigned line";
    const key = `${area}::${line}`;
    const bucket = byKey.get(key) ?? { key, area, line, rows: [] };
    bucket.rows.push(r);
    byKey.set(key, bucket);
  }
  return [...byKey.values()].sort(
    (a, b) => a.area.localeCompare(b.area) || a.line.localeCompare(b.line),
  );
}

const latestHandover = (g: LineGroup): string | null => {
  const stamps = g.rows
    .map((r) => r.actual_end ?? r.handed_over_at)
    .filter((s): s is string => !!s)
    .sort();
  return stamps.at(-1) ?? null;
};

export const Route = createFileRoute("/console/reports")({
  head: () => ({
    meta: [
      { title: "Reports | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "End-of-shift reports grouped area by line, today's events still needing action, and pushes waiting on maintenance.",
      },
      { property: "og:title", content: "Reports | OptiLog" },
      { property: "og:description", content: "One queue for every decision a supervisor owes." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const navigate = useNavigate();
  const isSupervisor = hasMinRole(user?.role ?? "operator", "supervisor");

  const reports = useReportApprovals(plantId, isSupervisor);
  const events = useEvents(plantId, todayStr(), { limit: 200 });
  const actions = useActionsByType(plantId, "maintenance_intervention", isSupervisor);

  const approveReport = useApproveShiftReport();
  const confirmEvent = useConfirmEvent();
  const resolveEvent = useResolveEvent();
  const createRCA = useCreateRCAFromEvent();
  const planMaintenance = usePlanMaintenance();

  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [planRow, setPlanRow] = useState<EventRow | null>(null);
  const [planDate, setPlanDate] = useState(todayStr());
  const [planNotes, setPlanNotes] = useState("");
  /** Which line's shift reports are drilled into. */
  const [openLine, setOpenLine] = useState<string | null>(null);

  if (!plantId) {
    return (
      <ConsoleShell title="Reports" subtitle="Everything waiting on a supervisor decision">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }
  if (!isSupervisor) {
    return (
      <ConsoleShell title="Reports" subtitle="Everything waiting on a supervisor decision">
        <p className="text-muted-foreground">Reports are handled by supervisors and above.</p>
      </ConsoleShell>
    );
  }

  const fail = (err: unknown) =>
    setActionError(err instanceof ApiError || err instanceof Error ? err.message : "Action failed");

  const allEvents = events.data ?? [];
  const unresolved = allEvents.filter((e) => UNRESOLVED_STATUSES.has(e.status));
  const reportRows = reports.data ?? [];
  const pendingReports = reportRows.filter((r) => !r.report_approved_at);
  const groups = groupReportRows(reportRows);

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

  return (
    <ConsoleShell
      title="Reports"
      subtitle="Shift reports by line, today's open events and maintenance pushes"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Shift reports pending"
          value={pendingReports.length}
          hint={
            reportRows.length ? "Handed over / ended, awaiting sign-off" : "Nothing waiting yet"
          }
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
      </div>

      {actionError ? (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {actionError}
        </div>
      ) : null}

      {/* --------------------------- shift reports --------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Shift reports by line
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          One row per line. Open a line to see its shifts and approve each report.
        </p>
        {reports.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : groups.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No shift reports waiting — no one has handed over yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Area</th>
                  <th className="px-4 py-2 text-left font-medium">Line</th>
                  <th className="px-4 py-2 text-left font-medium">Reports pending</th>
                  <th className="px-4 py-2 text-left font-medium">Events / open</th>
                  <th className="px-4 py-2 text-left font-medium">Latest handover</th>
                  <th className="px-4 py-2 text-right font-medium">
                    <span className="sr-only">Shift reports</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const open = openLine === g.key;
                  const pending = g.rows.filter((r) => !r.report_approved_at).length;
                  const eventCount = g.rows.reduce((n, r) => n + r.event_count, 0);
                  const openIssues = g.rows.reduce((n, r) => n + r.open_issues, 0);
                  const handover = latestHandover(g);
                  // Pending reports first, newest handover on top.
                  const sorted = [...g.rows].sort((a, b) => {
                    const aPending = a.report_approved_at ? 1 : 0;
                    const bPending = b.report_approved_at ? 1 : 0;
                    if (aPending !== bPending) return aPending - bPending;
                    return (b.actual_end ?? b.handed_over_at ?? "").localeCompare(
                      a.actual_end ?? a.handed_over_at ?? "",
                    );
                  });
                  return [
                    <tr
                      key={g.key}
                      className="cursor-pointer border-b border-border/60 align-top hover:bg-secondary/40"
                      onClick={() => setOpenLine(open ? null : g.key)}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{g.area}</td>
                      <td className="px-4 py-3 font-medium">{g.line}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {pending} of {g.rows.length}
                        {pending ? (
                          <span className="ml-1.5 text-xs font-normal text-warning">awaiting</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {eventCount} / {openIssues} open
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {handover ? `${handover.slice(0, 10)} ${handover.slice(11, 16)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenLine(open ? null : g.key);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary/60"
                        >
                          <ChevronRight
                            className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
                          />
                          {open ? "Hide" : "Open"}
                          <span className="sr-only"> shift reports for {g.line}</span>
                        </button>
                      </td>
                    </tr>,
                    open ? (
                      <tr
                        key={`${g.key}-detail`}
                        className="border-b border-border/60 bg-secondary/30"
                      >
                        <td colSpan={6} className="px-4 py-3">
                          <table className="w-full text-sm">
                            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                              <tr className="border-b border-border/60">
                                <th className="px-3 py-2 text-left font-medium">Shift</th>
                                <th className="px-3 py-2 text-left font-medium">Team</th>
                                <th className="px-3 py-2 text-left font-medium">
                                  Ended / handed over
                                </th>
                                <th className="px-3 py-2 text-left font-medium">Events / open</th>
                                <th className="px-3 py-2 text-left font-medium">Handover</th>
                                <th className="px-3 py-2 text-right font-medium">Decision</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sorted.map((r) => {
                                const approved = !!r.report_approved_at;
                                const endedAt = r.actual_end ?? r.handed_over_at;
                                const handedTotal =
                                  (r.sessions_ended ?? 0) + (r.sessions_open ?? 0);
                                return (
                                  <tr key={r.id} className="border-b border-border/40 align-top">
                                    <td className="px-3 py-3 font-medium capitalize">
                                      {r.shift_type} · {r.date}
                                      <p className="mt-0.5 text-xs font-normal capitalize text-muted-foreground">
                                        {r.still_running ? (
                                          <span className="font-medium text-warning">
                                            handed over · shift still running
                                          </span>
                                        ) : (
                                          r.status.replace(/_/g, " ")
                                        )}
                                      </p>
                                    </td>
                                    <td className="px-3 py-3 text-muted-foreground">
                                      {r.team_name || "—"}
                                    </td>
                                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                                      {endedAt ? endedAt.slice(11, 16) : "—"}
                                      {r.sessions_open ? (
                                        <span className="block text-xs font-normal">
                                          {r.sessions_ended ?? 0} of {handedTotal} handed over
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-3 tabular-nums">
                                      {r.event_count} / {r.open_issues} open
                                    </td>
                                    <td className="max-w-xs px-3 py-3 text-xs text-muted-foreground">
                                      <span className="line-clamp-3 whitespace-pre-line">
                                        {r.handover_notes || "—"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                      {approved ? (
                                        <button
                                          type="button"
                                          disabled={pendingId === r.id || approveReport.isPending}
                                          onClick={() =>
                                            run(r.id, async () => {
                                              await approveReport.mutateAsync({
                                                shiftId: r.id,
                                                approve: false,
                                              });
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
                                              await approveReport.mutateAsync({
                                                shiftId: r.id,
                                                approve: true,
                                              });
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
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
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
                    {e.timestamp.slice(11, 16)}
                    {e.area_name ? ` · ${e.area_name}` : ""} · {e.line_name} · {e.asset_name} ·{" "}
                    <span className="font-medium capitalize">
                      {STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}
                    </span>
                    {e.severity ? ` · ${e.severity}` : ""}
                    {e.operator_name ? ` · logged by ${e.operator_name}` : ""}
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
                    disabled={plannedEventIds.has(e.id) || e.status === "planned_maintenance"}
                    onClick={() => {
                      setPlanRow(e);
                      setPlanDate(todayStr());
                      setPlanNotes("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning disabled:opacity-50"
                    title={
                      plannedEventIds.has(e.id) || e.status === "planned_maintenance"
                        ? "Already pushed to maintenance"
                        : undefined
                    }
                  >
                    <Wrench className="size-3.5" />
                    {plannedEventIds.has(e.id) || e.status === "planned_maintenance"
                      ? "Planned"
                      : "Push to maintenance"}
                  </button>

                  {e.event_type === "breakdown" && !e.incident_id && e.status !== "escalated" ? (
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
            type: planRow.event_type,
            line: planRow.line_name,
            reported_cause: planRow.reported_cause,
            logged_by: planRow.operator_name,
            timestamp: planRow.timestamp,
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
