import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { useEvents } from "@/hooks/use-events";
import { useActions } from "@/hooks/use-actions";
import { usePlants } from "@/hooks/use-assets";

export const Route = createFileRoute("/console/rca")({
  head: () => ({
    meta: [
      { title: "RCA Workspace | Shift-Log Operations Console" },
      {
        name: "description",
        content:
          "A root cause workspace with incident timeline, cross-system evidence, 5-Why investigation, corrective and preventive actions.",
      },
      { property: "og:title", content: "RCA Workspace | Shift-Log" },
      {
        property: "og:description",
        content: "Investigate incidents with evidence from operators, MES, SCADA and CMMS.",
      },
    ],
  }),
  component: RcaPage,
});

function RcaPage() {
  const { data: plants } = usePlants();
  const plantId = plants?.[0]?.id ?? "";

  // Get escalated/resolved events as incidents
  const { data: eventsData } = useEvents({
    plant_id: plantId,
    status: "confirmed",
  });
  const { data: actionsData } = useActions();

  const incidents = eventsData?.items ?? [];
  const actions = actionsData?.items ?? [];

  const [selectedId, setSelectedId] = useState<string>("");
  const selectedEvent = incidents.find((e) => e.id === selectedId) ?? incidents[0];

  const linkedActions = actions.filter((a) => a.event_id === selectedEvent?.id);

  return (
    <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            Incidents
          </header>
          <ul className="divide-y divide-border/60">
            {incidents.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full px-4 py-3 text-left ${
                    e.id === (selectedId || incidents[0]?.id) ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <p className="text-sm font-medium">{e.observation || e.event_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.event_type} · {e.severity ?? "—"} · {e.status}
                  </p>
                </button>
              </li>
            ))}
            {incidents.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No incidents found.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-6">
          {selectedEvent ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Event" value={selectedEvent.event_type} hint={selectedEvent.timestamp.slice(0, 10)} />
                <StatCard label="Severity" value={selectedEvent.severity ?? "—"} tone={selectedEvent.severity === "critical" ? "danger" : selectedEvent.severity === "high" ? "warning" : "default"} />
                <StatCard label="Status" value={selectedEvent.status} />
                <StatCard label="Source" value={selectedEvent.source?.system ?? "—"} />
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-primary">Event details</p>
                  <p className="mt-1 text-sm text-foreground/90">{selectedEvent.observation}</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold">Details</h2>
                  <dl className="mt-3 space-y-3">
                    <Field label="Reported cause" value={selectedEvent.reported_cause ?? "—"} />
                    <Field label="Verified cause" value={selectedEvent.verified_cause ?? "—"} />
                    <Field label="Asset" value={selectedEvent.asset?.name ?? "—"} />
                    <Field label="Duration" value={selectedEvent.duration_seconds ? `${Math.round(selectedEvent.duration_seconds / 60)} min` : "—"} />
                  </dl>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold">Actions</h2>
                  {linkedActions.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {linkedActions.map((a) => (
                        <li key={a.id} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium">{a.type}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                          <p className="mt-1 text-xs capitalize">{a.status}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No actions linked yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              Select an incident to view details.
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value || "—"}</dd>
    </div>
  );
}