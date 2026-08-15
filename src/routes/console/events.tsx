import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell, SourceBadge } from "@/components/console/ConsoleShell";
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  assetName,
  events,
  lineName,
  teamName,
  type EventType,
  type SourceSystem,
} from "@/lib/ops-model";

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

const TYPES: (EventType | "all")[] = [
  "all",
  "downtime",
  "quality",
  "maintenance",
  "safety",
  "observation",
];
const SOURCES: (SourceSystem | "all")[] = [
  "all",
  "operator",
  "supervisor",
  "mes",
  "scada",
  "cmms",
  "erp",
];

function EventsPage() {
  const [type, setType] = useState<EventType | "all">("all");
  const [source, setSource] = useState<SourceSystem | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      events
        .filter((e) => (type === "all" ? true : e.event_type === type))
        .filter((e) => (source === "all" ? true : e.source === source))
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    [type, source],
  );

  return (
    <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
      <div className="flex flex-wrap gap-4">
        <Filter label="Type" values={TYPES} value={type} onChange={(v) => setType(v as EventType | "all")} />
        <Filter
          label="Source"
          values={SOURCES}
          value={source}
          onChange={(v) => setSource(v as SourceSystem | "all")}
        />
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
              <>
                <tr
                  key={e.id}
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className="cursor-pointer border-b border-border/60 hover:bg-secondary/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {e.timestamp.slice(5, 10)} {e.timestamp.slice(11, 16)}
                  </td>
                  <td className="px-4 py-3 font-medium">{e.description}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lineName(e.line_id)} · {assetName(e.asset_id)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.event_type} / {e.category}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{STATUS_LABEL[e.status]}</td>
                  <td className="px-4 py-3 text-right">
                    <SourceBadge>{SOURCE_LABEL[e.source]}</SourceBadge>
                  </td>
                </tr>
                {openId === e.id ? (
                  <tr key={`${e.id}_detail`} className="border-b border-border/60 bg-secondary/20">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <dl className="space-y-2 text-xs">
                          <Row k="Observation" v={e.observation} />
                          <Row k="Reported cause" v={e.reported_cause} />
                          <Row k="Verified cause" v={e.verified_cause} />
                          <Row k="Action" v={e.action} />
                        </dl>
                        <dl className="space-y-2 text-xs">
                          <Row k="Team" v={teamName(e.team_id)} />
                          <Row k="Severity" v={e.severity} />
                          <Row k="Source record" v={`${SOURCE_LABEL[e.source]} · ${e.source_record_id}`} />
                          <Row k="Evidence" v={e.evidence.join(", ")} />
                          <Row k="Incident" v={e.incident_id ?? ""} />
                        </dl>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </>
            ))}
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
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              v === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}