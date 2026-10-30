import { ChevronRight, CircleCheck, Loader2 } from "lucide-react";

const STEPS = [
  { id: "background", label: "Background" },
  { id: "five_why", label: "5-Why" },
  { id: "fishbone", label: "Fishbone" },
  { id: "timeline", label: "Timeline" },
  { id: "evidence", label: "Evidence" },
  { id: "actions", label: "Actions" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface RcaStepperProps {
  currentStep: StepId;
  completedSteps: Set<StepId>;
  onStepClick?: (stepId: StepId) => void;
  onNext?: () => void;
  onPrev?: () => void;
  className?: string;
}

export function RcaStepper({
  currentStep,
  completedSteps,
  onStepClick,
  onNext,
  onPrev,
  className,
}: RcaStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isCompleted = (stepId: StepId) => completedSteps.has(stepId);
  const isCurrent = (stepId: StepId) => stepId === currentStep;
  const canAccess = (stepId: StepId) => {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    return idx <= currentIndex || isCompleted(stepId);
  };
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex === STEPS.length - 1;
  const nextStep = STEPS[currentIndex + 1];
  const prevStep = STEPS[currentIndex - 1];
  const nextDisabled = isLast || !nextStep;
  const prevDisabled = isFirst || !prevStep || !onPrev;

  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const stepIsLast = idx === STEPS.length - 1;
          const completed = isCompleted(step.id);
          const current = isCurrent(step.id);
          const accessible = canAccess(step.id);

          return (
            <div key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => accessible && onStepClick?.(step.id)}
                disabled={!accessible}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : completed
                      ? "border-success bg-success/10 text-success"
                      : accessible
                        ? "border-border text-muted-foreground hover:bg-secondary/60"
                        : "border-border/30 text-muted-foreground/40"
                }`}
              >
                {current ? (
                  <span className="font-semibold">{idx + 1}</span>
                ) : completed ? (
                  <CircleCheck className="size-3.5" />
                ) : (
                  <span className="font-semibold">{idx + 1}</span>
                )}
                <span className="ml-1">{step.label}</span>
              </button>
              {!stepIsLast && (
                <ChevronRight
                  className={`size-3.5 ${
                    completed || current
                      ? "text-primary"
                      : accessible
                        ? "text-muted-foreground"
                        : "text-muted-foreground/40"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {!isLast && (onNext || onPrev) && (
        <div className="flex justify-end gap-2">
          {onPrev && !isFirst && (
            <button
              type="button"
              onClick={onPrev}
              disabled={prevDisabled}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                prevDisabled
                  ? "border-border text-muted-foreground"
                  : "border-input bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <ChevronRight className="-rotate-180 size-3.5" /> Prev
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                nextDisabled
                  ? "border-border text-muted-foreground"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export type { StepId };
export { STEPS };
