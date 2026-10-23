import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Loader2, Plus, X } from "lucide-react";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";
import {
  useAddAILesson,
  useLessonsToReview,
  useRejectAILesson,
  useVerifyAILesson,
} from "@/lib/hooks";

const LESSON_KINDS = [
  { value: "term", label: "Term" },
  { value: "mishearing", label: "Mishearing" },
  { value: "field_correction", label: "Field correction" },
  { value: "classification", label: "Classification" },
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  LESSON_KINDS.map((k) => [k.value, k.label]),
);

const SOURCE_LABEL: Record<string, string> = {
  human_edit: "human edit",
  ai_suggest: "AI suggestion",
  dual_transcript: "two transcripts agree",
  onboarding: "onboarding",
  external: "external source",
};

export const Route = createFileRoute("/console/vocabulary")({
  head: () => ({
    meta: [
      { title: "Vocabulary | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "Mishearings and corrections the AI is proposing from your transcripts — verify what should steer future transcription, reject what never should.",
      },
      { property: "og:title", content: "Vocabulary | OptiLog" },
      { property: "og:description", content: "Teach the AI your plant's vocabulary." },
    ],
  }),
  component: VocabularyPage,
});

function VocabularyPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const isSupervisor = hasMinRole(user?.role ?? "operator", "supervisor");

  const review = useLessonsToReview(plantId, isSupervisor);
  const verifyLesson = useVerifyAILesson();
  const rejectLesson = useRejectAILesson();
  const addLesson = useAddAILesson(plantId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Inline "add term" form + a reject that must be armed first.
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonKind, setLessonKind] = useState<string>("term");
  const [lessonTrigger, setLessonTrigger] = useState("");
  const [lessonCorrection, setLessonCorrection] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  if (!plantId) {
    return (
      <ConsoleShell title="Vocabulary" subtitle="What the AI is learning from your transcripts">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }
  if (!isSupervisor) {
    return (
      <ConsoleShell title="Vocabulary" subtitle="What the AI is learning from your transcripts">
        <p className="text-muted-foreground">Vocabulary is reviewed by supervisors and above.</p>
      </ConsoleShell>
    );
  }

  const fail = (err: unknown) =>
    setActionError(err instanceof ApiError || err instanceof Error ? err.message : "Action failed");

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setActionError(null);
    setPendingId(id);
    try {
      await fn();
    } catch (err) {
      fail(err);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <ConsoleShell
      title="Vocabulary"
      subtitle="Corrections the AI is proposing from your transcripts"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Vocabulary to review"
          value={review.total}
          hint={review.total ? "AI lessons awaiting a decision" : "Nothing waiting"}
          tone={review.total ? "warning" : "default"}
        />
      </div>

      {actionError ? (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {actionError}
        </div>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Vocabulary the AI is learning
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Mishearings and corrections spotted in your transcripts. Verified entries steer every
              future transcription; rejected ones never do.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLessonFormOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary/60"
          >
            {lessonFormOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {lessonFormOpen ? "Close" : "Add term"}
          </button>
        </div>

        {lessonFormOpen ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const correction = lessonCorrection.trim();
              const trigger = lessonTrigger.trim();
              if (!correction) return;
              if (lessonKind !== "term" && !trigger) return;
              setActionError(null);
              try {
                await addLesson.mutateAsync({
                  kind: lessonKind,
                  correction,
                  ...(lessonKind === "term" ? { trigger: correction } : { trigger }),
                });
                setLessonTrigger("");
                setLessonCorrection("");
                setLessonFormOpen(false);
              } catch (err) {
                fail(err);
              }
            }}
            className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor="lesson-kind">Kind</Label>
              <select
                id="lesson-kind"
                value={lessonKind}
                onChange={(e) => setLessonKind(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LESSON_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="lesson-correction">Correction (what it should say)</Label>
              <Input
                id="lesson-correction"
                value={lessonCorrection}
                onChange={(e) => setLessonCorrection(e.target.value)}
                placeholder="e.g. pulp"
                required
                className="mt-1"
              />
            </div>
            {lessonKind !== "term" ? (
              <div className="sm:col-span-2">
                <Label htmlFor="lesson-trigger">Heard (the wrong word or phrase)</Label>
                <Input
                  id="lesson-trigger"
                  value={lessonTrigger}
                  onChange={(e) => setLessonTrigger(e.target.value)}
                  placeholder="e.g. pork"
                  required
                  className="mt-1"
                />
              </div>
            ) : null}
            <div className="flex justify-end sm:col-span-2">
              <button
                type="submit"
                disabled={addLesson.isPending || !lessonCorrection.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {addLesson.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save correction
              </button>
            </div>
          </form>
        ) : null}

        {review.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : review.items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing waiting — the AI hasn't proposed any corrections.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {review.items.map((lesson) => {
              const trigger =
                typeof lesson.trigger === "object" && lesson.trigger
                  ? (lesson.trigger.text ?? "")
                  : "";
              const showTrigger =
                lesson.kind !== "term" && trigger && trigger !== lesson.correction;
              const ineffective = lesson.status === "ineffective";
              return (
                <div
                  key={lesson.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold break-words">
                      {showTrigger ? (
                        <>
                          <span className="text-muted-foreground line-through">{trigger}</span>
                          <span className="mx-2 text-muted-foreground">→</span>
                        </>
                      ) : null}
                      <span className="font-mono">{lesson.correction}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {KIND_LABEL[lesson.kind] ?? lesson.kind} · heard{" "}
                      <span className="font-medium">{lesson.hits ?? 1}</span>× ·{" "}
                      {SOURCE_LABEL[lesson.source] ?? lesson.source}
                      {lesson.last_seen_at ? ` · last ${lesson.last_seen_at.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={
                        ineffective
                          ? "rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase text-muted-foreground"
                          : "rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-bold uppercase text-warning"
                      }
                      title={
                        ineffective
                          ? "Kept being wrong — dropped from the AI prompts until re-verified"
                          : "The AI proposed this; it is not applied until verified"
                      }
                    >
                      {ineffective ? "Stopped helping" : "Needs review"}
                    </span>
                    <button
                      type="button"
                      disabled={pendingId === lesson.id}
                      onClick={() =>
                        run(lesson.id, async () => {
                          await verifyLesson.mutateAsync(lesson.id);
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-bold text-success disabled:opacity-50"
                    >
                      {pendingId === lesson.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CircleCheck className="size-3.5" />
                      )}
                      {ineffective ? "Re-verify" : "Verify"}
                    </button>
                    {rejectingId === lesson.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary/60"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === lesson.id}
                          onClick={() =>
                            run(lesson.id, async () => {
                              setRejectingId(null);
                              await rejectLesson.mutateAsync(lesson.id);
                            })
                          }
                          className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50"
                        >
                          Reject forever
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRejectingId(lesson.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary/60 disabled:opacity-50"
                        disabled={pendingId === lesson.id}
                      >
                        <X className="size-3.5" /> Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}
