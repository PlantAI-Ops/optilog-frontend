import { Minus, Plus, Trash2 } from "lucide-react";

interface EvidenceEntry {
  label: string;
  source: string;
}

interface EvidenceEditorProps {
  entries: EvidenceEntry[];
  onChange: (entries: EvidenceEntry[]) => void;
  editing?: boolean;
}

export function EvidenceEditor({ entries, onChange, editing = false }: EvidenceEditorProps) {
  const addEntry = () => {
    onChange([...entries, { label: "", source: "operator" }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: keyof EvidenceEntry, value: string) => {
    const next = [...entries];
    const item = next[index];
    if (!item) return;
    item[field] = value;
    onChange(next);
  };

  const SOURCES = ["operator", "supervisor", "mes", "scada", "cmms", "erp"] as const;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Evidence</h2>
        {editing && (
          <button
            type="button"
            onClick={addEntry}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary/60"
          >
            <Plus className="size-3" /> Add Evidence
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {entries.map((entry, idx) => (
          <li key={idx} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Evidence {idx + 1}</span>
              {editing && (entries ?? []).length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Label
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={entry.label}
                    onChange={(e) => updateField(idx, "label", e.target.value)}
                    placeholder="Evidence description"
                    className="rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
                  />
                ) : (
                  <p className="text-sm">{entry.label || "—"}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Source
                </label>
                {editing ? (
                  <select
                    value={entry.source}
                    onChange={(e) =>
                      updateField(idx, "source", e.target.value as (typeof SOURCES)[number])
                    }
                    className="rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground capitalize">{entry.source}</span>
                )}
              </div>
            </div>
          </li>
        ))}
        {entries.length === 0 && editing && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No evidence entries defined yet. Click "Add Evidence" to begin.
          </p>
        )}
      </ul>
    </div>
  );
}
