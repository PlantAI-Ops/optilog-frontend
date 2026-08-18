import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { ConsoleShell, SourceBadge, StatCard } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/ops-model";
import { useShiftLog } from "@/lib/shift-log";
import { useIncidents, useIncidentEvents } from "@/lib/hooks";

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
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];

  const [id, setId] = useState<string | null>(null);

  const incidents = useIncidents(plantId, "open,in_progress,under_review");
  const selectedId = id ?? incidents.data?.[0]?.id;
  const linkedEvents = useIncidentEvents(plantId, selectedId);

  const incident = incidents.data?.find((i) => i.id === selectedId);

  if (!plantId) {
    return (
      <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }

  if (incidents.isLoading) {
    return (
      <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (incidents.error) {
    return (
      <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load incidents. {incidents.error.message}
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            Incidents
          </header>
          <ul className="divide-y divide-border/60">
            {incidents.data?.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setId(i.id)}
                  className={`w-full px-4 py-3 text-left ${
                    i.id === selectedId ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {i.ref} {i.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.line_name} · {i.duration_minutes} min · {STATUS_LABEL[i.status as keyof typeof STATUS_LABEL] ?? i.status}
                  </p>
                </button>
              </li>
            ))}
            {incidents.data?.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No open incidents.</li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-6">
          {incident ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Incident" value={incident.ref} hint={incident.date} />
                <StatCard label="Duration" value={`${incident.duration_minutes} min`} tone="warning" />
                <StatCard
                  label="Shift"
                  value={incident.shift_id ? `Shift ${incident.shift_id.split("_").pop()}` : "—"}
                  hint={incident.line_name}
                />
                <StatCard label="Owner" value={incident.owner} hint={`Due ${incident.due_date}`} />
              </div>

              <div className="flex gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-primary">AI correlation</p>
                  <p className="mt-1 text-sm text-foreground/90">{incident.ai_insight}</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold">Timeline</h2>
                  <ol className="mt-3 space-y-3">
                    {incident.timeline.map((t) => (
                      <li key={`${t.time}-${t.label}`} className="flex gap-3">
                        <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {t.time}
                        </span>
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                        <span className="flex-1 text-sm">{t.label}</span>
                        <SourceBadge>{SOURCE_LABEL[t.source as keyof typeof SOURCE_LABEL] ?? t.source}</SourceBadge>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold">Evidence</h2>
                  <ul className="mt-3 space-y-2">
                    {incident.evidence.map((e) => (
                      <li
                        key={e.label}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        {e.label}
                        <SourceBadge>{SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}</SourceBadge>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Investigation</h2>
                <dl className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Problem" value={incident.problem} />
                  <Field label="Observed condition" value={incident.observed_condition} />
                  <Field label="Root cause" value={incident.root_cause} />
                </dl>

                <h3 className="mt-5 text-sm font-semibold">5 Why</h3>
                <ol className="mt-2 space-y-2">
                  {incident.five_why.map((w, idx) => (
                    <li key={idx} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {idx + 1}. {w.question || "Not yet answered"}
                      </p>
                      <p className="mt-1 text-sm">{w.answer || "—"}</p>
                    </li>
                  ))}
                </ol>

                <dl className="mt-5 grid gap-3 md:grid-cols-2">
                  <Field label="Corrective action" value={incident.corrective_action} />
                  <Field label="Preventive action" value={incident.preventive_action} />
                </dl>
              </div>

              <div className="rounded-xl border border-border bg-card">
                <header className="border-b border-border px-4 py-3 text-sm font-semibold">
                  Linked operational events
                </header>
                {linkedEvents.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {linkedEvents.data?.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm">{e.description}</span>
                        <SourceBadge>{SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}</SourceBadge>
                      </li>
                    ))}
                    {linkedEvents.data?.length === 0 ? (
                      <li className="px-4 py-6 text-sm text-muted-foreground">
                        No linked events.
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20 text-sm text-muted-foreground">
              Select an incident from the list.
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
