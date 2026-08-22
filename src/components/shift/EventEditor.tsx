import { useState } from "react";
import type { EventStatus, ShiftEvent } from "@/lib/shift-log";
import { STATUS_LABEL } from "@/lib/shift-log";

const STATUSES: EventStatus[] = ["draft", "confirmed", "investigating", "resolved"];

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <textarea
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 max-h-40 w-full resize-none overflow-y-auto rounded-xl border border-input bg-secondary px-3 py-3 text-base text-foreground outline-none focus:border-ring"
      />
    </label>
  );
}

export function EventEditor({
  event,
  onSave,
  onCancel,
  saveLabel = "Save event",
}: {
  event: ShiftEvent;
  onSave: (e: ShiftEvent) => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(event);
  const set = (patch: Partial<ShiftEvent>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Event type
          </span>
          <input
            value={draft.event_type}
            onChange={(e) => set({ event_type: e.target.value })}
            className="mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-3 text-base outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Asset
          </span>
          <input
            value={draft.asset}
            onChange={(e) => set({ asset: e.target.value })}
            className="mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-3 text-base outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Subsystem
          </span>
          <input
            value={draft.subsystem}
            onChange={(e) => set({ subsystem: e.target.value })}
            className="mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-3 text-base outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Duration (min)
          </span>
          <input
            inputMode="numeric"
            value={draft.duration_minutes ?? ""}
            onChange={(e) =>
              set({ duration_minutes: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-3 text-base outline-none focus:border-ring"
          />
        </label>
      </div>

      <Field label="Observation" value={draft.observation} onChange={(v) => set({ observation: v })} />
      <Field
        label="Reported cause"
        value={draft.reported_cause}
        onChange={(v) => set({ reported_cause: v })}
      />
      <Field
        label="Suspected cause"
        value={draft.suspected_cause}
        onChange={(v) => set({ suspected_cause: v })}
      />
      <Field
        label="Verified cause"
        value={draft.verified_cause}
        onChange={(v) => set({ verified_cause: v })}
        placeholder="Confirmed by maintenance / QA"
      />
      <Field label="Action taken" value={draft.action_taken} onChange={(v) => set({ action_taken: v })} />

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set({ status: s })}
              className={`rounded-xl border px-2 py-3 text-sm font-bold ${
                draft.status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {draft.transcript ? (
        <div className="max-h-32 overflow-y-auto rounded-xl bg-secondary p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Transcript
          </p>
          <p className="mt-1 text-sm italic leading-snug break-words">"{draft.transcript}"</p>
        </div>
      ) : null}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-14 flex-1 rounded-2xl border border-border bg-secondary text-base font-bold text-secondary-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="h-14 flex-[2] rounded-2xl bg-primary text-base font-black text-primary-foreground"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}