import { Minus, Plus, Trash2 } from "lucide-react";

interface FiveWhyStep {
  question: string;
  answer: string;
}

interface FiveWhyEditorProps {
  steps: FiveWhyStep[];
  onChange: (steps: FiveWhyStep[]) => void;
  editing?: boolean;
}

export function FiveWhyEditor({ steps, onChange, editing = false }: FiveWhyEditorProps) {
  const addStep = () => {
    onChange([...steps, { question: "", answer: "" }]);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, value: string) => {
    const next = [...steps];
    const item = next[index];
    if (!item) return;
    item.question = value;
    onChange(next);
  };

  const updateAnswer = (index: number, value: string) => {
    const next = [...steps];
    const item = next[index];
    if (!item) return;
    item.answer = value;
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">5-Why Investigation</h2>
        {editing && (
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary/60"
          >
            <Plus className="size-3" /> Add Why
          </button>
        )}
      </div>
      <ol className="space-y-3">
        {steps.map((step, idx) => (
          <li key={idx} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{idx + 1}. Why?</span>
              {editing && (steps ?? []).length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {editing ? (
                <>
                  <textarea
                    value={step.question}
                    onChange={(e) => updateQuestion(idx, e.target.value)}
                    placeholder="Why did this happen?"
                    className="w-full rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
                    rows={2}
                  />
                  <textarea
                    value={step.answer}
                    onChange={(e) => updateAnswer(idx, e.target.value)}
                    placeholder="Answer..."
                    className="w-full rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
                    rows={2}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{step.question || "Not yet answered"}</p>
                  <p className="mt-1 text-sm">{step.answer || "—"}</p>
                </>
              )}
            </div>
          </li>
        ))}
        {steps.length === 0 && editing && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No 5-Why steps defined yet. Click "Add Why" to begin.
          </p>
        )}
      </ol>
    </div>
  );
}
