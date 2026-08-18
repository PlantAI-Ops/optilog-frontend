import { Fragment, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldPlus } from "lucide-react";
import { ConsoleShell, SourceBadge } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/ops-model";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import { useCreateIncident, useEvents } from "@/lib/hooks";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const TYPES = ["all", "downtime", "breakdown", "quality", "maintenance", "safety", "observation"] as const;
const SOURCES = ["all", "operator", "supervisor", "mes", "scada", "cmms", "erp"] as const;

export const Route = createFileRoute("/console/events")({
  head: () => ({
    meta: [
      { title: "Operational Event Stream | Shift-Log" },
      {
        name: "description",
        content:
          "One canonical event stream merging operator voice reports with MES, SCADA, CMMS and ERP records, filterable by type, source and line.",
      },
      { property: "og:title", content: "Operational Event Stream | Shift-Log" },
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

  const events = useEvents(plantId, todayStr(), { type, source });
  const createIncident = useCreateIncident();
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

  if (events.error) {
    return (
      <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load events. {events.error.message}
        </div>
      </ConsoleShell>
    );
  }

  const rows = events.data ?? [];

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
              <th className="px-4 py-2 text-right font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
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
                    {e.line_name} · {e.asset_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.event_type} / {e.category}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SourceBadge>{SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}</SourceBadge>
                  </td>
                </tr>
                {openId === e.id ? (
                  <tr className="border-b border-border/60 bg-secondary/20">
                    <td colSpan={6} className="px-4 py-4">
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
                          <Row k="Source record" v={`${SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source} · ${e.source_record_id}`} />
                          <Row k="Evidence" v={e.evidence.join(", ")} />
                          <Row k="Incident" v={e.incident_id ?? ""} />
                        </dl>
                      </div>
                      {e.event_type === "breakdown" && canCreateRCA && !e.incident_id ? (
                        <div className="mt-4 border-t border-border/60 pt-3">
                          <button
                            type="button"
                            disabled={createIncident.isPending}
                            onClick={() => {
                              if (!plantId) return;
                              createIncident.mutate(
                                { plantId, data: { event_id: e.id, title: e.description } },
                                {
                                  onSuccess: () =>
                                    navigate({ to: "/console/rca" }),
                                },
                              );
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                          >
                            {createIncident.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <ShieldPlus className="size-3" />
                            )}
                            Create RCA
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No events found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
  };
  return labels[v] ?? v;
}
