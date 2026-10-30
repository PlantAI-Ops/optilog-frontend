import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Check,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { ConsoleShell, SourceBadge, StatCard } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL, STATUS_LABEL, areas, lines } from "@/lib/ops-model";
import { ApiError } from "@/lib/api";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import {
  useApproveRCA,
  useCloseRCA,
  useCreateRCA,
  useCreateRCAFromEvent,
  useEvents,
  useIncidentEvents,
  useIncidentRCA,
  useIncidents,
  useReopenRCA,
  useRCAActions,
  useUpdateRCA,
  type RCARow,
} from "@/lib/hooks";
import { RcaStepper, STEPS, type StepId } from "@/components/rca/RcaStepper";
import { RcaBackgroundCard } from "@/components/rca/RcaBackgroundCard";
import { FiveWhyEditor } from "@/components/rca/FiveWhyEditor";
import { FishboneEditor } from "@/components/rca/FishboneEditor";
import { TimelineEditor } from "@/components/rca/TimelineEditor";
import { EvidenceEditor } from "@/components/rca/EvidenceEditor";
import { RcaActionsCard } from "@/components/rca/RcaActionsCard";

export const Route = createFileRoute("/console/rca")({
  validateSearch: (search: Record<string, unknown>): { incident?: string | undefined } => ({
    incident: typeof search["incident"] === "string" ? search["incident"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "RCA Workspace | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "A root cause workspace with incident timeline, cross-system evidence, 5-Why investigation, corrective and preventive actions.",
      },
      { property: "og:title", content: "RCA Workspace | OptiLog" },
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
  const search = Route.useSearch();

  const [selectedId, setSelectedId] = useState<string | null>(search["incident"] ?? null);
  const [editing, setEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("background");
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
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
  const closeRCA = useCloseRCA();
  const reopenRCA = useReopenRCA();
  const createRCAFromEvent = useCreateRCAFromEvent();
  const rcaActions = useRCAActions(currentId);
  const breakdownEvents = useEvents(plantId, new Date().toISOString().slice(0, 10), {
    type: "breakdown",
  });

  const hasRCA = !!rca.data?.id && rca.data.status !== "draft";
  const isDraft = rca.data?.status === "draft";
  const isInProgress = rca.data?.status === "in_progress";
  const isCompleted = rca.data?.status === "completed";
  const isApproved = rca.data?.status === "approved";
  const isClosed = rca.data?.status === "closed";
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

  if (incidents.error && !(incidents.error instanceof ApiError && incidents.error.status === 404)) {
    return (
      <ConsoleShell title="Root cause analysis" subtitle="Incidents as first-class investigations">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load incidents. {incidents.error.message}
        </div>
      </ConsoleShell>
    );
  }

  const incidentsData = incidents.data ?? [];

  const canStartInvestigation = () => {
    if (
      !currentId ||
      isInProgress ||
      isCompleted ||
      isApproved ||
      isClosed ||
      !isDraft ||
      !canCreateRCA
    )
      return false;
    return true;
  };

  const canSubmitForReview = () => {
    if (!isInProgress || isCompleted || isApproved || isClosed || !canCreateRCA || editing)
      return false;
    return true;
  };

  const canApprove = () => {
    return canCreateRCA && isCompleted;
  };

  const canClose = () => {
    return canCreateRCA && isApproved;
  };

  const canReopen = () => {
    return canCreateRCA && isClosed;
  };

  const handleStartInvestigation = () => {
    if (!currentId) return;
    createRCA.mutate(
      { incidentId: currentId, data: { status: "draft" } },
      {
        onSuccess: () => {
          setEditing(true);
          setForm({});
          setCurrentStep("background");
          setCompletedSteps(new Set());
        },
      },
    );
  };

  const handleSubmitForReview = () => {
    if (!rca.data) return;
    updateRCA.mutate({ rcaId: rca.data.id, data: { status: "in_progress" } });
  };

  const handleSave = () => {
    if (!rca.data) return;
    updateRCA.mutate({ rcaId: rca.data.id, data: form }, { onSuccess: () => setEditing(false) });
  };

  const startEditing = () => {
    const formData: Partial<RCARow> = {
      problem: rca.data?.problem ?? "",
      observed_condition: rca.data?.observed_condition ?? "",
      root_cause: rca.data?.root_cause ?? "",
      corrective_action: rca.data?.corrective_action ?? "",
      preventive_action: rca.data?.preventive_action ?? "",
      five_why: rca.data?.five_why ?? [],
      timeline: rca.data?.timeline ?? [],
      evidence: rca.data?.evidence ?? [],
      fishbone: rca.data?.fishbone ?? [],
    };
    if (rca.data?.containment_action !== undefined) {
      formData.containment_action = rca.data.containment_action;
    }
    if (rca.data?.root_cause_category !== undefined) {
      formData.root_cause_category = rca.data.root_cause_category;
    }
    setForm(formData);
    setEditing(true);
  };

  const canCreateNewRCA = () => {
    return canCreateRCA && !isInProgress && !isCompleted && !isApproved && !isClosed;
  };

  const canEdit = () => {
    return canCreateRCA && (isDraft || isInProgress || isCompleted) && !editing;
  };

  const canSave = () => {
    return canCreateRCA && editing;
  };

  const handleApprove = () => {
    if (!rca.data) return;
    approveRCA.mutate(rca.data.id);
  };

  const handleClose = () => {
    if (!rca.data) return;
    closeRCA.mutate(rca.data.id);
  };

  const handleReopen = () => {
    if (!rca.data) return;
    reopenRCA.mutate(rca.data.id);
  };

  const stepDisabled = (stepId: StepId) => {
    const stepIndex = STEPS.findIndex((s) => s.id === stepId);
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    return stepIndex > currentIndex && !completedSteps.has(stepId);
  };

  const handleStepClick = (stepId: StepId) => {
    if (!stepDisabled(stepId)) {
      setCurrentStep(stepId);
    }
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
                  <ChevronDown
                    className={`size-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  />
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
                                {e.area_name ? `${e.area_name} · ` : ""}
                                {e.line_name} · {e.timestamp.slice(11, 16)} ·{" "}
                                {SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}
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
            {incidentsData.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(i.id);
                    setEditing(false);
                  }}
                  className={`w-full px-4 py-3 text-left ${
                    i.id === currentId ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {i.ref} {i.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.line_name} · {i.duration_minutes} min ·{" "}
                    {STATUS_LABEL[i.status as keyof typeof STATUS_LABEL] ?? i.status}
                    {i.severity ? ` · ${i.severity}` : ""}
                  </p>
                </button>
              </li>
            ))}
            {incidentsData.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No open incidents.</li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-6">
          {incident ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Incident" value={incident.ref} hint={incident.date} />
                <StatCard
                  label="Duration"
                  value={`${incident.duration_minutes} min`}
                  tone="warning"
                />
                <StatCard
                  label="Shift"
                  value={incident.shift_name ?? "—"}
                  hint={incident.line_name}
                />
                <StatCard label="Owner" value={incident.owner} hint={`Due ${incident.due_date}`} />
              </div>

              {rca.isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-border bg-card py-10">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : !rca.data ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No investigation started for this incident.
                  </p>
                  {canStartInvestigation() ? (
                    <button
                      type="button"
                      onClick={handleStartInvestigation}
                      disabled={createRCA.isPending}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {createRCA.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Start Investigation
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          rca.data.status === "approved"
                            ? "bg-success/20 text-success"
                            : rca.data.status === "completed"
                              ? "bg-primary/20 text-primary"
                              : rca.data.status === "closed"
                                ? "bg-warning/20 text-warning"
                                : rca.data.status === "in_progress"
                                  ? "bg-info/20 text-info"
                                  : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {rca.data.status}
                      </span>
                      {rca.data.ai_insight && currentStep === "review" ? (
                        <div className="flex gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                          <p className="text-xs text-foreground/90">{rca.data.ai_insight}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {canEdit() && !isClosed ? (
                        <button
                          type="button"
                          onClick={startEditing}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                      ) : null}
                      {editing && canSave() ? (
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={updateRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {updateRCA.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Save className="size-3" />
                          )}
                          Save
                        </button>
                      ) : null}
                      {canSubmitForReview() ? (
                        <button
                          type="button"
                          onClick={handleSubmitForReview}
                          disabled={updateRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {updateRCA.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Submit for Review
                        </button>
                      ) : null}
                      {canApprove() ? (
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={approveRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground disabled:opacity-60"
                        >
                          {approveRCA.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Approve
                        </button>
                      ) : null}
                      {canClose() ? (
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={closeRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                        >
                          {closeRCA.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <ShieldAlert className="size-3" />
                          )}
                          Close
                        </button>
                      ) : null}
                      {canReopen() ? (
                        <button
                          type="button"
                          onClick={handleReopen}
                          disabled={reopenRCA.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-semibold text-info-foreground disabled:opacity-60"
                        >
                          {reopenRCA.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3" />
                          )}
                          Reopen
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Stepper - show when RCA exists */}
                  <RcaStepper
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                    onStepClick={handleStepClick}
                    onNext={() => {
                      const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
                      const nextStep = STEPS[currentIndex + 1];
                      if (nextStep) {
                        setCompletedSteps((prev) => new Set([...prev, currentStep]));
                        setCurrentStep(nextStep.id);
                      }
                    }}
                    onPrev={() => {
                      const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
                      const prevStep = STEPS[currentIndex - 1];
                      if (prevStep) {
                        setCurrentStep(prevStep.id);
                      }
                    }}
                  />

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Background Card (Step 1) */}
                    {currentStep === "background" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <RcaBackgroundCard
                          rca={editing ? ({ ...rca.data, ...form } as RCARow) : rca.data}
                          editing={editing}
                          incidentLine={incident?.line_name ?? null}
                          incidentShift={incident?.shift_name ?? null}
                          incidentArea={
                            incident
                              ? (areas.find(
                                  (a) =>
                                    a.id === lines.find((l) => l.id === incident.line_id)?.area_id,
                                )?.name ?? null)
                              : null
                          }
                          onChange={(field, value) => {
                            setForm((prev) => ({ ...prev, [field]: value }));
                          }}
                        />
                      </div>
                    )}

                    {/* 5-Why (Step 2) */}
                    {currentStep === "five_why" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <FiveWhyEditor
                          steps={
                            editing && form.five_why ? form.five_why : (rca.data?.five_why ?? [])
                          }
                          onChange={(steps) => setForm((f) => ({ ...f, five_why: steps }))}
                          editing={editing}
                        />
                      </div>
                    )}

                    {/* Fishbone (Step 3) */}
                    {currentStep === "fishbone" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <FishboneEditor
                          entries={
                            editing && form.fishbone ? form.fishbone : (rca.data?.fishbone ?? [])
                          }
                          onChange={(entries) => setForm((f) => ({ ...f, fishbone: entries }))}
                          editing={editing}
                        />
                      </div>
                    )}

                    {/* Timeline (Step 4) */}
                    {currentStep === "timeline" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <TimelineEditor
                          entries={
                            editing && form.timeline ? form.timeline : (rca.data?.timeline ?? [])
                          }
                          onChange={(entries) => setForm((f) => ({ ...f, timeline: entries }))}
                          editing={editing}
                        />
                      </div>
                    )}

                    {/* Evidence (Step 4) */}
                    {currentStep === "evidence" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <EvidenceEditor
                          entries={
                            editing && form.evidence ? form.evidence : (rca.data?.evidence ?? [])
                          }
                          onChange={(entries) => setForm((f) => ({ ...f, evidence: entries }))}
                          editing={editing}
                        />
                      </div>
                    )}

                    {/* Actions (Step 5) */}
                    {currentStep === "actions" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <RcaActionsCard incidentId={currentId ?? ""} actions={rcaActions.data} />
                      </div>
                    )}

                    {/* Review (Step 6) */}
                    {currentStep === "review" && (
                      <div className="col-span-2 rounded-xl border border-border bg-card p-4">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                              RCA Status & Actions
                            </h3>
                            <p className="text-sm">
                              Current status:{" "}
                              <span className="font-medium capitalize">{rca.data.status}</span>
                            </p>
                            {rca.data.ai_insight && (
                              <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                                  AI Insight
                                </p>
                                <p className="text-sm text-foreground/90 whitespace-pre-line">
                                  {rca.data.ai_insight}
                                </p>
                              </div>
                            )}
                          </div>
                          {editing && (
                            <div className="pt-4">
                              <p className="text-xs text-muted-foreground">
                                Save changes to finalize the review.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Linked operational events */}
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
                          <li
                            key={e.id}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                          >
                            <span className="text-sm">{e.description}</span>
                            <div className="text-xs text-muted-foreground">
                              {e.area_name ? `${e.area_name} · ` : ""}
                              {e.line_name}
                            </div>
                            <SourceBadge>
                              {SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}
                            </SourceBadge>
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
