import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell, SourceBadge } from "@/components/console/ConsoleShell";
import { useEvents } from "@/hooks/use-events";
import { usePlants } from "@/hooks/use-assets";
import type { EventType, EventStatus, Severity } from "@/types/api";

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
  "production_stop",
  "downtime",
  "quality",
  "maintenance",
  "safety",
  "observation",
];
const STATUSES: (EventStatus | "all")[] = [
  "all",
  "draft",
  "confirmed",
  "rejected",
  "resolved",
];

function EventsPage() {
  const [type, setType] = useState<EventType | "all">("all");
  const [status, setStatus] = useState<EventStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: plants } = usePlants();
  const plantId = plants?.[0]?.id ?? "";

  const queryParams = {
    ...(plantId ? { plant_id: plantId } : {}),
    ...(type !== "all" ? { event_type: type } : {}),
    ...(status !== "all" ? { status } : {}),
  };

  const { data: eventsData, isLoading } = useEvents(queryParams);

  const rows = useMemo(() => {
    return (eventsData?.items ?? []).sort(
      (a, b) => (a.timestamp < b.timestamp ? 1 : -1),
    );
  }, [eventsData]);

  return (
    <ConsoleShell title="Events" subtitle="Canonical operational event stream — all sources">
      <div className="flex flex-wrap gap-4">
        <Filter label="Type" values={TYPES} value={type} onChange={(v) => setType(v as EventType | "all")} />
        <Filter
          label="Status"
          values={STATUSES}
          value={status}
          onChange={(v) => setStatus(v as EventStatus | "all")}
        />
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Loading events...
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Observation</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Severity</th>
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
                    <td className="px-4 py-3 font-medium">{e.observation || e.event_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.event_type}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{e.severity ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{e.status}</td>
                    <td className="px-4 py-3 text-right">
                      <SourceBadge>{e.source?.system ?? e.source?.type ?? "unknown"}</SourceBadge>
                    </td>
                  </tr>
                  {openId === e.id ? (
                    <tr className="border-b border-border/60 bg-secondary/20">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <dl className="space-y-2 text-xs">
                            <Row k="Observation" v={e.observation} />
                            <Row k="Reported cause" v={e.reported_cause ?? ""} />
                            <Row k="Verified cause" v={e.verified_cause ?? ""} />
                            <Row k="Asset" v={e.asset?.name ?? "—"} />
                          </dl>
                          <dl className="space-y-2 text-xs">
                            <Row k="Team" v={e.team_id ?? "—"} />
                            <Row k="Shift" v={e.shift_id ?? "—"} />
                            <Row k="Source" v={`${e.source?.system ?? "unknown"} · ${e.source?.record_id ?? "—"}`} />
                            <Row k="Duration" v={e.duration_seconds ? `${Math.round(e.duration_seconds / 60)} min` : "—"} />
                          </dl>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No events found. Events will appear here as they are recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
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