import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const MAX_KEY_TERMS = 50;
export const MAX_KEY_TERM_CHARS = 60;

/**
 * Chip editor for the plant's `key_terms` — the domain words speech
 * recognition should spell correctly ("pulp", not "pork"). Enter or the Add
 * button commits the draft; each term can be removed again.
 */
export function KeyTermsInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const term = draft.trim().slice(0, MAX_KEY_TERM_CHARS);
    if (!term || value.length >= MAX_KEY_TERMS) return;
    if (value.some((t) => t.toLowerCase() === term.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, term]);
    setDraft("");
  };

  const full = value.length >= MAX_KEY_TERMS;

  return (
    <div>
      <Label htmlFor={id}>Key terms</Label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Domain words the voice AI should spell correctly ({value.length}/{MAX_KEY_TERMS}).
      </p>
      {value.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((term) => (
            <li
              key={term}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium"
            >
              {term}
              <button
                type="button"
                aria-label={`Remove ${term}`}
                onClick={() => onChange(value.filter((t) => t !== term))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={MAX_KEY_TERM_CHARS}
          placeholder="e.g. pulp"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-8"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || full}
          className="shrink-0 rounded-md border border-border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
