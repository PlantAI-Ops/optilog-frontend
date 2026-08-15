import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { areas, assets, lines, plant } from "@/lib/ops-model";

export const Route = createFileRoute("/console/data")({
  head: () => ({
    meta: [
      { title: "Canonical Data Model & API | Shift-Log" },
      {
        name: "description",
        content:
          "The canonical operational model behind Shift-Log: asset hierarchy, the OperationalEvent schema, and the REST, webhook and export surface for downstream systems.",
      },
      { property: "og:title", content: "Canonical Data Model & API | Shift-Log" },
      {
        property: "og:description",
        content: "Asset hierarchy, event schema and the outbound API surface.",
      },
    ],
  }),
  component: DataPage,
});

const EVENT_SCHEMA = `OperationalEvent
├── id                 string
├── timestamp          ISO-8601
├── plant / area / line / asset
├── shift / team
├── event_type         downtime | quality | maintenance | safety | observation | production
├── category           string
├── severity           low | medium | high | critical
├── description / observation
├── reported_cause / verified_cause
├── action
├── status             open | in_progress | resolved | under_review
├── source             operator | supervisor | mes | scada | cmms | erp | api | import | ai
├── source_record_id   string
├── evidence[]         attachments, audio, photos, external records
└── metadata           free-form key/value`;

const ENDPOINTS = [
  { method: "GET", path: "/api/public/events?shift_id=&line_id=&since=", desc: "Query canonical events" },
  { method: "POST", path: "/api/public/events", desc: "Ingest an event from an external system" },
  { method: "GET", path: "/api/public/shifts", desc: "Shift records with production and downtime" },
  { method: "GET", path: "/api/public/incidents/{id}", desc: "Incident with timeline and evidence" },
  { method: "POST", path: "/api/public/webhooks/subscribe", desc: "Subscribe to event.created / incident.updated" },
  { method: "GET", path: "/api/public/exports/events.csv", desc: "Scheduled CSV / JSON export" },
];

function DataPage() {
  return (
    <ConsoleShell title="Data model" subtitle="One canonical layer, many producers and consumers">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Asset hierarchy</h2>
          <ul className="mt-3 space-y-1 font-mono text-xs">
            <li>{plant.name}</li>
            {areas.map((area) => (
              <li key={area.id}>
                <span className="text-muted-foreground">└──</span> {area.name}
                <ul className="ml-6 space-y-1">
                  {lines
                    .filter((l) => l.area_id === area.id)
                    .map((line) => (
                      <li key={line.id}>
                        <span className="text-muted-foreground">└──</span> {line.name}
                        <ul className="ml-6">
                          {assets
                            .filter((a) => a.line_id === line.id)
                            .map((a) => (
                              <li key={a.id} className="text-muted-foreground">
                                └── {a.name}
                              </li>
                            ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Canonical event schema</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs text-muted-foreground">
            {EVENT_SCHEMA}
          </pre>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-3 text-sm font-semibold">
          Outbound surface — how other systems consume Shift-Log
        </header>
        <table className="w-full text-sm">
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.path} className="border-b border-border/60 last:border-0">
                <td className="w-16 px-4 py-2 font-mono text-xs text-primary">{e.method}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.path}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </ConsoleShell>
  );
}