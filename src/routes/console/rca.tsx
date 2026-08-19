import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Loader2, Pencil, Plus, Save, Sparkles, Check } from "lucide-react";
import { ConsoleShell, SourceBadge, StatCard } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/ops-model";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import {
  useApproveRCA,
  useCreateRCA,
  useCreateRCAFromEvent,
  useEvents,
  useIncidentEvents,
  useIncidentRCA,
  useIncidents,
  useUpdateRCA,
  type RCARow,
} from "@/lib/hooks";

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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<RCARow>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const incidents = useIncidents(plantId, "open,in_progress,under_review");
  const currentId = selectedId ?? incidents.data?.[0]?.id;
  const incident = incidents.data?.find((i) => i.id === currentId);

  const rca = useIncidentRCA(currentId);
  const linkedEvents = useIncidentEvents(plantId, currentId);
  const createRCA = useCreateRCA();
  const updateRCA = useUpdateRCA();
  const approveRCA = useApproveRCA();
  const createRCAFromEvent = useCreateRCAFromEvent();
  const breakdownEvents = useEvents(plantId, new Date().toISOString().slice(0, 10), { type: "breakdown" });

  const hasRCA = !!rca.data;
  const isDraft = rca.data?.status === "draft";
  const canCreateRCA = hasMinRole(user?.role ?? "operator", "supervisor");
  const unlinkedBreakdowns = breakdownEvents.data?.filter((e) => !e.incident_id) ?? [];

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

  const handleStartInvestigation = () => {
    if (!currentId) return;
    createRCA.mutate(
      { incidentId: currentId, data: { status: "draft" } },
      { onSuccess: () => { setEditing(true); setForm({}); } },
    );
  };

  const handleSave = () => {
    if (!rca.data) return;
    updateRCA.mutate(
      { rcaId: rca.data.id, data: form },
      { onSuccess: () => setEditing(false) },
    );
  };

  const handleApprove = () => {
    if (!rca.data) return;
    approveRCA.mutate(rca.data.id);
  };

  const startEditing = () => {
    setForm({
      problem: rca.data?.problem ?? "",
      observed_condition: rca.data?.observed_condition ?? "",
      root_cause: rca.data?.root_cause ?? "",
      corrective_action: rca.data?.corrective_action ?? "",
      preventive_action: rca.data?.preventive_action ?? "",
    });
    setEditing(true);
  };

  return (
    <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-semibold">
            Incidents
            {canCreateRCA ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
                >
                  <Plus className="size-3" />
                  Create RCA
                  <ChevronDown className={`size-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen ? (
                  <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-xl border border-border bg-card shadow-lg">
                    <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                      Select a breakdown event
                    </div>
                    <ul className="max-h-60 overflow-y-auto">
                      {unlinkedBreakdowns.length === 0 ? (
                        <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No unlinked breakdown events.
                        </li>
                      ) : (
                        unlinkedBreakdowns.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              disabled={createRCAFromEvent.isPending}
                              onClick={() => {
                                createRCAFromEvent.mutate(
                                  { eventId: e.id },
                                  {
                                    onSuccess: () => {
                                      setDropdownOpen(false);
                                      incidents.refetch();
                                    },
                                  },
                                );
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-secondary/60 disabled:opacity-60"
                            >
                              <p className="text-xs font-medium">{e.description}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {e.line_name} · {e.timestamp.slice(11, 16)} · {SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}
                              </p>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </header>
          <ul className="divide-y divide-border/60">
            {incidents.data?.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedId(i.id); setEditing(false); }}
                  className={`w-full px-4 py-3 text-left ${
                    i.id === currentId ? "bg-secondary" : "hover:bg-secondary/50"
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

              {rca.isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-border bg-card py-10">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : !hasRCA ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">No investigation started for this incident.</p>
                  <button
                    type="button"
                    onClick={handleStartInvestigation}
                    disabled={createRCA.isPending}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {createRCA.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    Start Investigation
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        rca.data.status === "approved" ? "bg-success/20 text-success" :
                        rca.data.status === "completed" ? "bg-primary/20 text-primary" :
                        "bg-secondary text-secondary-foreground"
                      }`}>
                        {rca.data.status}
                      </span>
                      {rca.data.ai_insight ? (
                        <div className="flex gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                          <p className="text-xs text-foreground/90">{rca.data.ai_insight}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {!editing && isDraft ? (
                        <button
                          type="button"
                          onClick={startEditing}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                      ) : null}
                      {editing ? (
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={updateRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {updateRCA.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                          Save
                        </button>
                      ) : null}
                      {rca.data.status === "completed" ? (
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={approveRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground disabled:opacity-60"
                        >
                          {approveRCA.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          Approve
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <h2 className="text-sm font-semibold">Timeline</h2>
                      <ol className="mt-3 space-y-3">
                        {rca.data.timeline?.map((t) => (
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
                        {rca.data.evidence?.map((e) => (
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
                      <Field label="Problem" value={editing ? (form.problem ?? "") : rca.data.problem} editing={editing}
                        onChange={(v) => setForm((f) => ({ ...f, problem: v }))} />
                      <Field label="Observed condition" value={editing ? (form.observed_condition ?? "") : rca.data.observed_condition} editing={editing}
                        onChange={(v) => setForm((f) => ({ ...f, observed_condition: v }))} />
                      <Field label="Root cause" value={editing ? (form.root_cause ?? "") : rca.data.root_cause} editing={editing}
                        onChange={(v) => setForm((f) => ({ ...f, root_cause: v }))} />
                    </dl>

                    <h3 className="mt-5 text-sm font-semibold">5 Why</h3>
                    <ol className="mt-2 space-y-2">
                      {rca.data.five_why?.map((w, idx) => (
                        <li key={idx} className="rounded-lg border border-border p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {idx + 1}. {w.question || "Not yet answered"}
                          </p>
                          <p className="mt-1 text-sm">{w.answer || "—"}</p>
                        </li>
                      ))}
                    </ol>

                    <dl className="mt-5 grid gap-3 md:grid-cols-2">
                      <Field label="Corrective action" value={editing ? (form.corrective_action ?? "") : rca.data.corrective_action} editing={editing}
                        onChange={(v) => setForm((f) => ({ ...f, corrective_action: v }))} />
                      <Field label="Preventive action" value={editing ? (form.preventive_action ?? "") : rca.data.preventive_action} editing={editing}
                        onChange={(v) => setForm((f) => ({ ...f, preventive_action: v }))} />
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
              )}
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

function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      {editing && onChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded border border-input bg-secondary px-2 py-1 text-sm outline-none focus:border-ring"
        />
      ) : (
        <dd className="mt-1 text-sm">{value || "—"}</dd>
      )}
    </div>
  );
}
