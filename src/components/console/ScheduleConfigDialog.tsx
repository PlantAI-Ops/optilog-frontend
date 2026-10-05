import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useRotationConfig,
  useShiftPatternMutations,
  useShiftPatterns,
  useUpdateRotationConfig,
  type ShiftPattern,
} from "@/lib/hooks";

const DAY_ABBR = ["M", "T", "W", "T", "F", "S", "S"];
const SHIFT_TYPE_OPTIONS = ["morning", "afternoon", "night", "day"];

function HourInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (h: number) => void;
  disabled?: boolean;
}) {
  const display = `${String(((value % 24) + 24) % 24).padStart(2, "0")}:00`;
  return (
    <input
      type="time"
      value={display}
      disabled={disabled}
      onChange={(e) => {
        const h = parseInt(e.target.value.split(":")[0] ?? "0", 10);
        if (!isNaN(h)) onChange(h);
      }}
      className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
    />
  );
}

function DayToggle({
  days,
  onToggle,
  disabled,
}: {
  days: number[];
  onToggle: (day: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {DAY_ABBR.map((abbr, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled || (days.includes(i) && days.length === 1)}
          onClick={() => onToggle(i)}
          className={cn(
            "size-6 rounded border text-[10px] font-semibold transition-colors",
            days.includes(i)
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50",
            (disabled || (days.includes(i) && days.length === 1)) && "opacity-50",
          )}
          title={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}
        >
          {abbr}
        </button>
      ))}
    </div>
  );
}

function errorMessage(err: unknown): string | null {
  return err instanceof Error ? err.message : null;
}

/**
 * Post-onboarding shift configuration: edit shift-pattern windows (hours, days,
 * type, add/remove) and the rotation cycle/phase. Schedule grid recomputes
 * automatically after each save (queries invalidated by the mutation hooks).
 */
export function ScheduleConfigDialog({
  plantId,
  open,
  onOpenChange,
}: {
  plantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const patterns = useShiftPatterns(plantId);
  const { create, update, remove } = useShiftPatternMutations(plantId);
  const rotation = useRotationConfig(plantId);
  const updateRotation = useUpdateRotationConfig(plantId);

  const [newType, setNewType] = useState("morning");
  const [newStart, setNewStart] = useState(6);
  const [newEnd, setNewEnd] = useState(14);
  const [newDays, setNewDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [rotationPhase, setRotationPhase] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setNewType("morning");
      setNewStart(6);
      setNewEnd(14);
      setNewDays([0, 1, 2, 3, 4, 5, 6]);
      setConfirmingDelete(null);
      setRotationPhase(null);
    }
  }, [open]);

  useEffect(() => {
    if (rotation.data && rotationPhase === null) {
      setRotationPhase(rotation.data.day_offset);
    }
  }, [rotation.data, rotationPhase]);

  const patchDays = (pattern: ShiftPattern, day: number) => {
    const next = pattern.days_of_week.includes(day)
      ? pattern.days_of_week.filter((d) => d !== day)
      : [...pattern.days_of_week, day].sort((a, b) => a - b);
    if (next.length === 0) return;
    update.mutate({ id: pattern.id, days_of_week: next });
  };

  const addPattern = async () => {
    if (newDays.length === 0) return;
    try {
      await create.mutateAsync({
        shift_type: newType,
        start_hour: newStart,
        end_hour: newEnd,
        days_of_week: [...newDays].sort((a, b) => a - b),
      });
    } catch {
      /* error surfaced via create.error */
    }
  };

  const deletePattern = async (id: string) => {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      return;
    }
    setConfirmingDelete(null);
    try {
      await remove.mutateAsync(id);
    } catch {
      /* error surfaced via remove.error */
    }
  };

  const rotationPattern = rotation.data?.pattern;
  const isExtendedRotation = rotationPattern === "extended";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>
            Configure the plant's shift windows and rotation cycle. The schedule grid and template
            preview recompute automatically.
          </DialogDescription>
        </DialogHeader>

        {/* ── Shift patterns ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shift windows
          </p>

          {patterns.isLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : patterns.isError ? (
            <p className="text-sm text-muted-foreground">
              Shift patterns aren't available yet — the backend needs GET /shift-patterns.
            </p>
          ) : (patterns.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shift windows configured. Add one below.
            </p>
          ) : (
            <ul className="space-y-2">
              {(patterns.data ?? []).map((p) => {
                const pending = update.isPending && update.variables?.id === p.id;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "rounded-lg border border-border bg-secondary/30 p-3 space-y-2",
                      !p.active && "opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={p.shift_type}
                        disabled={pending}
                        onChange={(e) => update.mutate({ id: p.id, shift_type: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      >
                        {[...new Set([p.shift_type, ...SHIFT_TYPE_OPTIONS])].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <HourInput
                        value={p.start_hour}
                        disabled={pending}
                        onChange={(h) => update.mutate({ id: p.id, start_hour: h })}
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <HourInput
                        value={p.end_hour}
                        disabled={pending}
                        onChange={(h) => update.mutate({ id: p.id, end_hour: h })}
                      />
                      <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={p.active}
                          disabled={pending}
                          onChange={(e) => update.mutate({ id: p.id, active: e.target.checked })}
                          className="accent-primary"
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => deletePattern(p.id)}
                        className={cn(
                          "rounded-md border p-1.5 transition-colors",
                          confirmingDelete === p.id
                            ? "border-red-500 bg-red-500/10 text-red-600"
                            : "border-border text-muted-foreground hover:text-red-600",
                        )}
                        title={confirmingDelete === p.id ? "Click again to confirm" : "Delete"}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <DayToggle
                      days={p.days_of_week}
                      disabled={pending}
                      onToggle={(d) => patchDays(p, d)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add new pattern */}
          <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Add shift window</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {SHIFT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <HourInput value={newStart} onChange={setNewStart} />
              <span className="text-xs text-muted-foreground">–</span>
              <HourInput value={newEnd} onChange={setNewEnd} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={create.isPending || newDays.length === 0}
                onClick={addPattern}
              >
                {create.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add
              </Button>
            </div>
            <DayToggle days={newDays} onToggle={(d) =>
              setNewDays((prev) =>
                prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
              )
            } />
            {errorMessage(create.error) ? (
              <p role="alert" className="text-xs text-red-600">
                {errorMessage(create.error)}
              </p>
            ) : null}
          </div>

          {errorMessage(update.error) || errorMessage(remove.error) ? (
            <p role="alert" className="text-xs text-red-600">
              {errorMessage(update.error) ?? errorMessage(remove.error)}
            </p>
          ) : null}
        </section>

        {/* ── Rotation cycle ─────────────────────────────────────────────── */}
        {rotation.data ? (
          <section className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rotation cycle
            </p>
            {isExtendedRotation ? (
              <p className="text-sm text-muted-foreground">
                Day → Night → Off (extended rotation — fixed sequence).
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {(["2-2-2-2", "3-3-3-3"] as const).map((pat) => (
                  <button
                    key={pat}
                    type="button"
                    disabled={updateRotation.isPending}
                    onClick={() => updateRotation.mutate({ pattern: pat })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      rotationPattern === pat
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {pat}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1.5">
                  <Label htmlFor="rotation-phase" className="text-xs text-muted-foreground">
                    Phase (day offset)
                  </Label>
                  <Input
                    id="rotation-phase"
                    type="number"
                    min={0}
                    value={rotationPhase ?? 0}
                    onChange={(e) => setRotationPhase(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="h-8 w-20 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      updateRotation.isPending ||
                      rotationPhase === null ||
                      rotationPhase === rotation.data.day_offset
                    }
                    onClick={() => {
                      if (rotationPhase === null) return;
                      updateRotation.mutate({ day_offset: rotationPhase });
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
            {errorMessage(updateRotation.error) ? (
              <p role="alert" className="text-xs text-red-600">
                {errorMessage(updateRotation.error)}
              </p>
            ) : null}
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
