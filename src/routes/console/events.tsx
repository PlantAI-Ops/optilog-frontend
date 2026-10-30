import { Fragment, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldPlus, Wrench } from "lucide-react";
import { ConsoleShell, SourceBadge } from "@/components/console/ConsoleShell";
import { PlanMaintenanceDialog } from "@/components/shift/PlanMaintenanceDialog";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/ops-model";
import { ApiError } from "@/lib/api";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import {
  ROUTED_EVENT_STATUSES,
  useActionsByType,
  useCreateRCAFromEvent,
  useEvents,
  usePlanMaintenance,
  type ActionRow,
  type EventRow,
} from "@/lib/hooks";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const TYPES = [
  "all",
  "downtime",
  "breakdown",
  "quality",
  "maintenance",
  "safety",
  "observation",
  "environmental",
] as const;
const SOURCES = ["all", "operator", "supervisor", "mes", "scada", "cmms", "erp"] as const;

export const Route = createFileRoute("/console/events")({
  head: () => ({
    meta: [
      { title: "Operational Event Stream | OptiLog" },
      {
        name: "description",
        content:
          "One canonical event stream merging operator voice reports with MES, SCADA, CMMS and ERP records, filterable by type, source and line.",
      },
      { property: "og:title", content: "Operational Event Stream | OptiLog" },
      {
        property: "og:description",
        content: "Operator, MES, SCADA and CMMS records normalised into one model.",
      },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const navigate = useNavigate();

  const [type, setType] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [planRow, setPlanRow] = useState<EventRow | null>(null);
  const [planDate, setPlanDate] = useState(todayStr());
  const [planNotes, setPlanNotes] = useState("");

  const events = useEvents(plantId, todayStr(), { type, source });
  const actions = useActionsByType(plantId, "maintenance_intervention");
  const createRCAFromEvent = useCreateRCAFromEvent();
  const planMaintenance = usePlanMaintenance();
  const canCreateRCA = hasMinRole(user?.role ?? "operator", "supervisor");

  if (!plantId) {
    return (
      <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }

  if (events.isLoading) {
    return (
      <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (events.error && !(events.error instanceof ApiError && events.error.status === 404)) {
    return (
      <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load events. {events.error.message}
        </div>
      </ConsoleShell>
    );
  }

  const rows = events.data ?? [];

  // event_id → maintenance action, so routed rows can show their #ACT- ref
  // (list_actions is tenant-wide; joined client-side against today's rows).
  const actionList = Array.isArray(actions.data) ? actions.data : (actions.data?.items ?? []);
  const actionByEvent = new Map<string, ActionRow>();
  for (const a of actionList) {
    if (a.event_id) actionByEvent.set(a.event_id, a);
  }

  const startRCA = (e: EventRow) => {
    createRCAFromEvent.mutate(
      { eventId: e.id },
      {
        onSuccess: (rca) => navigate({ to: "/console/rca", search: { incident: rca.incident_id } }),
      },
    );
  };

  const openPlanDialog = (e: EventRow) => {
    setPlanRow(e);
    setPlanDate(todayStr());
    setPlanNotes("");
  };

  return (
    <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
      <div className="flex flex-wrap gap-4">
        <Filter label="Type" values={TYPES} value={type} onChange={setType} />
        <Filter label="Source" values={SOURCES} value={source} onChange={setSource} />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Time</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="px-4 py-2 text-left font-medium">Line / asset</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Operator</th>
              <th className="px-4 py-2 text-right font-medium">Source</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const maintenanceAction = actionByEvent.get(e.id);
              const routedToRCA = !!e.incident_id;
              const isRouted = ROUTED_EVENT_STATUSES.has(e.status);
              const canPlan = canCreateRCA && !isRouted && !maintenanceAction;
              const canRCA = canCreateRCA && !isRouted && !routedToRCA;
              return (
                <Fragment key={e.id}>
                  <tr
                    onClick={() => setOpenId(openId === e.id ? null : e.id)}
                    className="cursor-pointer border-b border-border/60 hover:bg-secondary/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                      {e.timestamp.slice(5, 10)} {e.timestamp.slice(11, 16)}
                    </td>
                    <td className="px-4 py-3 font-medium">{e.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.area_name ? `${e.area_name} · ` : ""}
                      {e.line_name} · {e.asset_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.event_type} / {e.category}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.operator_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <SourceBadge>
                        {SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}
                      </SourceBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {routedToRCA ? (
                          <Link
                            to="/console/rca"
                            search={{ incident: e.incident_id ?? undefined }}
                            title="Open the RCA workspace for this incident"
                            className="rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-[11px] font-bold text-info hover:bg-info/20"
                          >
                            {e.incident_ref || `#${(e.incident_id ?? "").slice(-4)}`}
                          </Link>
                        ) : null}
                        {maintenanceAction || e.status === "planned_maintenance" ? (
                          <Link
                            to="/console/maintenance"
                            title="Open planned maintenance"
                            className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning hover:bg-warning/20"
                          >
                            {maintenanceAction?.ref ?? "Maintenance"}
                          </Link>
                        ) : null}
                        {canRCA ? (
                          <button
                            type="button"
                            disabled={createRCAFromEvent.isPending}
                            onClick={() => startRCA(e)}
                            className="flex items-center gap-1 rounded-lg border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] font-bold text-info disabled:opacity-50"
                          >
                            {createRCAFromEvent.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <ShieldPlus className="size-3" />
                            )}
                            RCA
                          </button>
                        ) : null}
                        {canPlan ? (
                          <button
                            type="button"
                            disabled={planMaintenance.isPending}
                            onClick={() => openPlanDialog(e)}
                            className="flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-bold text-warning disabled:opacity-50"
                          >
                            <Wrench className="size-3" />
                            Maintenance
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {openId === e.id ? (
                    <tr className="border-b border-border/60 bg-secondary/20">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <dl className="space-y-2 text-xs">
                            <Row k="Observation" v={e.observation} />
                            <Row k="Reported cause" v={e.reported_cause} />
                            <Row k="Verified cause" v={e.verified_cause} />
                            <Row k="Action" v={e.action} />
                          </dl>
                          <dl className="space-y-2 text-xs">
                            <Row k="Team" v={e.team_name} />
                            <Row k="Severity" v={e.severity} />
                            <Row k="Operator" v={e.operator_name ?? "—"} />
                            <Row
                              k="Source record"
                              v={`${SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source} · ${e.source_record_id}`}
                            />
                            <Row k="Evidence" v={e.evidence.join(", ")} />
                            <Row k="Incident" v={e.incident_ref ?? e.incident_id ?? ""} />
                          </dl>
                        </div>
                        {canPlan || canRCA ? (
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                            {canPlan ? (
                              <button
                                type="button"
                                disabled={planMaintenance.isPending}
                                onClick={() => openPlanDialog(e)}
                                className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning disabled:opacity-50"
                              >
                                <Wrench className="size-3" />
                                Push to maintenance
                              </button>
                            ) : null}
                            {canRCA ? (
                              <button
                                type="button"
                                disabled={createRCAFromEvent.isPending}
                                onClick={() => startRCA(e)}
                                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                              >
                                {createRCAFromEvent.isPending ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <ShieldPlus className="size-3" />
                                )}
                                Create RCA
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No events found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
            try {
              await planMaintenance.mutateAsync({
                shiftId: planRow.shift_id,
                eventId: planRow.id,
                plantId: plantId ?? "",
                plannedDate: planDate,
                notes: planNotes,
                assignedTeam: "",
              });
              setPlanRow(null);
            } catch {
              // Dialog stays open and shows the error.
            }
          }}
        />
      ) : null}
    </ConsoleShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
      <dd>{v || "—"}</dd>
    </div>
  );
}

function Filter({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              v === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {filterLabel(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function filterLabel(v: string): string {
  if (v === "all") return "All";
  const labels: Record<string, string> = {
    operator: "Operator",
    supervisor: "Supervisor",
    mes: "MES",
    scada: "SCADA",
    cmms: "CMMS",
    erp: "ERP",
    downtime: "Downtime",
    breakdown: "Breakdown",
    quality: "Quality",
    maintenance: "Maintenance",
    safety: "Safety",
    observation: "Observation",
    environmental: "Environmental",
  };
  return labels[v] ?? v;
}
