import { Minus, Plus, Trash2 } from "lucide-react";

interface FishboneCause {
  category: string;
  causes: string[];
}

const SIX_M_CATEGORIES = [
  "Man",
  "Method",
  "Machine",
  "Material",
  "Measurement",
  "Environment",
] as const;

interface FishboneEditorProps {
  entries: FishboneCause[];
  onChange: (entries: FishboneCause[]) => void;
  editing?: boolean;
}

export function FishboneEditor({ entries, onChange, editing = false }: FishboneEditorProps) {
  const addCategory = () => {
    onChange([...entries, { category: "Man", causes: [] }]);
  };

  const removeCategory = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const addCause = (categoryIndex: number) => {
    const next = [...entries];
    const item = next[categoryIndex];
    if (!item) return;
    item.causes = [...item.causes, ""];
    onChange(next);
  };

  const removeCause = (categoryIndex: number, causeIndex: number) => {
    const next = [...entries];
    const item = next[categoryIndex];
    if (!item) return;
    item.causes = item.causes.filter((_, i) => i !== causeIndex);
    onChange(next);
  };

  const updateCategory = (index: number, value: string) => {
    const next = [...entries];
    const item = next[index];
    if (!item) return;
    item.category = value;
    onChange(next);
  };

  const updateCause = (categoryIndex: number, causeIndex: number, value: string) => {
    const next = [...entries];
    const item = next[categoryIndex];
    if (!item) return;
    item.causes[causeIndex] = value;
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Fishbone (Ishikawa) Analysis</h2>
        {editing && (
          <button
            type="button"
            onClick={addCategory}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary/60"
          >
            <Plus className="size-3" /> Add Category
          </button>
        )}
      </div>
      <div className="space-y-3">
        {entries.map((entry, catIdx) => (
          <div key={catIdx} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {catIdx + 1}. Category
              </span>
              {editing && entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCategory(catIdx)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {editing ? (
                <input
                  value={entry.category}
                  onChange={(e) => updateCategory(catIdx, e.target.value)}
                  placeholder="Category name"
                  className="w-full rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
                />
              ) : (
                <p className="text-sm font-medium capitalize">{entry.category || "—"}</p>
              )}
              <div className="grid gap-2">
                {entry.causes.map((cause, causeIdx) => (
                  <div
                    key={causeIdx}
                    className="flex items-center gap-2 rounded-lg border border-border p-2"
                  >
                    {editing ? (
                      <input
                        value={cause}
                        onChange={(e) => updateCause(catIdx, causeIdx, e.target.value)}
                        placeholder="Potential cause"
                        className="flex-1 rounded border-none bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-0"
                      />
                    ) : (
                      <span className="text-sm">{cause || "—"}</span>
                    )}
                    {editing && entry.causes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCause(catIdx, causeIdx)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
                {editing && (
                  <button
                    type="button"
                    onClick={() => addCause(catIdx)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-secondary/60"
                  >
                    <Plus className="size-2.5" /> Add Cause
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && editing && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No fishbone categories defined yet. Click "Add Category" to begin.
          </p>
        )}
        {!editing && entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No fishbone analysis recorded.
          </p>
        )}
      </div>
    </div>
  );
}
