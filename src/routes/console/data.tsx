import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { usePlants } from "@/hooks/use-assets";

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
├── plant_id           string
├── event_type         production_stop | downtime | quality | maintenance | safety | observation
├── category           string
├── severity           low | medium | high | critical
├── observation        string
├── reported_cause     string
├── verified_cause     string
├── duration_seconds   number
├── status             draft | confirmed | rejected | resolved | deleted
├── source             { type, system, record_id }
├── evidence           string[]
└── metadata           object`;

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/events", desc: "Query operational events" },
  { method: "POST", path: "/api/v1/events", desc: "Create an operational event" },
  { method: "GET", path: "/api/v1/shifts", desc: "Shift records with production and downtime" },
  { method: "POST", path: "/api/v1/shifts", desc: "Create a new shift" },
  { method: "GET", path: "/api/v1/teams", desc: "List teams" },
  { method: "GET", path: "/api/v1/assets/plants", desc: "List plants in hierarchy" },
  { method: "POST", path: "/api/v1/recordings", desc: "Upload voice recording" },
  { method: "POST", path: "/api/v1/attachments", desc: "Upload photo/document attachment" },
];

function DataPage() {
  const { data: plants, isLoading } = usePlants();
  const plant = plants?.[0];

  return (
    <ConsoleShell title="Data model" subtitle="One canonical layer, many producers and consumers">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Asset hierarchy</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
          ) : plant ? (
            <ul className="mt-3 space-y-1 font-mono text-xs">
              <li>{plant.name}</li>
              <li className="text-muted-foreground">└── (fetch areas, lines, assets from API)</li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No plants configured. Create a plant via the API to populate the hierarchy.
            </p>
          )}
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
          API surface — how to interact with OptiLog
        </header>
        <table className="w-full text-sm">
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.path + e.method} className="border-b border-border/60 last:border-0">
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