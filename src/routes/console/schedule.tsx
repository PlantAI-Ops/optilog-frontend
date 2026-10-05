import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { CurrentShiftBanner } from "@/components/console/CurrentShiftBanner";
import { ScheduleConfigDialog } from "@/components/console/ScheduleConfigDialog";
import { TeamMembersDialog } from "@/components/console/TeamMembersDialog";
import { EmptyPlantState } from "@/components/console/EmptyPlantState";
import { CyclePreview, ShiftCycleStrip, type StripRow } from "@/components/ShiftCycleStrip";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import {
  useShiftsPattern,
  useShiftOverrideMutations,
  usePlantTeamsDetail,
  useShiftsNow,
  useTeams,
  type PatternDay,
  type PatternTeam,
  type TeamDetail,
} from "@/lib/hooks";
import { shiftCellStyle, shiftLabel, shiftTypeLetter, LETTER_LABELS } from "@/lib/shift-now";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "Shift template preview and weekly grid — click a shift for the crew, members, and overrides.",
      },
      { property: "og:title", content: "Schedule | OptiLog" },
      { property: "og:description", content: "Shift template preview and weekly grid." },
    ],
  }),
  component: SchedulePage,
});

const LEGEND: Array<[string, string]> = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["night", "Night"],
  ["day", "Day"],
  ["off", "Off"],
];

const OVERRIDE_TYPES = ["morning", "afternoon", "night", "day", "off"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseHour(h: string | null): number | null {
  if (!h) return null;
  const value = parseInt(h.slice(0, 2), 10);
  return Number.isNaN(value) ? null : value;
}

function SchedulePage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const canManage = !!user && hasMinRole(user.role, "supervisor");

  const [anchor, setAnchor] = useState(todayStr());
  const [selected, setSelected] = useState<{ team: PatternTeam; day: PatternDay } | null>(null);
  const [membersTeam, setMembersTeam] = useState<TeamDetail | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState(false);
  const [ovType, setOvType] = useState<string>("morning");
  const [ovStart, setOvStart] = useState(6);
  const [ovEnd, setOvEnd] = useState(14);

  const pattern = useShiftsPattern(plantId, anchor, 7);
  const teamsDetail = usePlantTeamsDetail(plantId);
  const teams = useTeams(plantId);
  const overrides = useShiftOverrideMutations(plantId);
  const shiftsNow = useShiftsNow(plantId);

  const cols = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(anchor), i), "yyyy-MM-dd")),
    [anchor],
  );
  const today = todayStr();
  const currentShift = shiftsNow.data?.current_shift ?? null;

  const moveAnchor = (days: number) =>
    setAnchor(format(addDays(parseISO(anchor), days), "yyyy-MM-dd"));

  const rangeLabel = `${format(parseISO(anchor), "MMM d")} – ${format(
    addDays(parseISO(anchor), 6),
    "MMM d, yyyy",
  )}`;

  const detailMap = new Map((teamsDetail.data ?? []).map((t) => [t.id, t]));

  /* Re-resolve the selection against fresh pattern data so overrides/edits
   * show updated values immediately after invalidation. */
  const sel = (() => {
    if (!selected) return null;
    const team = pattern.data?.teams.find((t) => t.team_id === selected.team.team_id);
    const day = team?.days.find((d) => d.date === selected.day.date);
    if (team && day) return { team, day };
    return selected;
  })();
  const selectedDetail = sel ? detailMap.get(sel.team.team_id) : undefined;
  const selectedMemberIds =
    selectedDetail?.member_ids ?? selectedDetail?.members?.map((m) => m.id) ?? [];
  const isTrack = sel?.team.kind === "track";

  const openCell = (team: PatternTeam, day: PatternDay) => {
    setSelected({ team, day });
    setOverrideForm(false);
    setOvType(day.shift_type ?? "off");
    setOvStart(parseHour(day.start) ?? 6);
    setOvEnd(parseHour(day.end) ?? 14);
  };

  const openMembers = (team: TeamDetail) => {
    setSelected(null);
    setMembersTeam(team);
  };

  const applyOverride = async () => {
    if (!sel) return;
    try {
      await overrides.upsert.mutateAsync({
        row_key: sel.team.team_id,
        date: sel.day.date,
        shift_type: ovType,
        start_hour: ovType === "off" ? null : ovStart,
        end_hour: ovType === "off" ? null : ovEnd,
      });
      setOverrideForm(false);
    } catch {
      /* error surfaced via overrides.upsert.error */
    }
  };

  const clearOverride = async () => {
    if (!sel?.day.override_id) return;
    try {
      await overrides.remove.mutateAsync(sel.day.override_id);
      setOverrideForm(false);
    } catch {
      /* error surfaced via overrides.remove.error */
    }
  };

  /* Template strip rows — same rows the grid shows, rendered as cycle letters. */
  const stripRows: StripRow[] = (pattern.data?.teams ?? []).map((pt) => {
    const byDate = new Map(pt.days.map((d) => [d.date, d]));
    return {
      key: pt.team_id,
      label: pt.team_name,
      cells: cols.map((col) => {
        const d = byDate.get(col);
        return {
          shiftType: d?.shift_type ?? null,
          start: d?.start ?? null,
          end: d?.end ?? null,
        };
      }),
    };
  });

  /* Legend for the weekly grid: letters seen in the visible week, with the
     first-seen hours per letter (matches the strip's M/A/N/D/- vocabulary). */
  const legendSeen = new Map<string, { type: string; start: string; end: string }>();
  for (const pt of pattern.data?.teams ?? []) {
    for (const day of pt.days) {
      if (!day.shift_type) continue;
      const letter = shiftTypeLetter(day.shift_type);
      if (!legendSeen.has(letter)) {
        legendSeen.set(letter, {
          type: day.shift_type,
          start: day.start ?? "",
          end: day.end ?? "",
        });
      }
    }
  }
  const gridLegend = (["M", "A", "N", "D", "-"] as const)
    .filter((letter) => legendSeen.has(letter))
    .map((letter) => {
      const seen = legendSeen.get(letter)!;
      return {
        letter,
        label: LETTER_LABELS[letter],
        time: seen.start && seen.end ? `${seen.start}–${seen.end}` : "",
        dot: shiftCellStyle(seen.type).dot,
      };
    });

  if (!plantId) {
    return (
      <ConsoleShell title="Schedule" subtitle="Weekly shift pattern per crew">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }

  const gridHeader = (
    <div className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] gap-2 pb-1">
      <div />
      {cols.map((col) => (
        <div
          key={col}
          className={cn(
            "text-center text-xs",
            col === today ? "font-semibold text-primary" : "font-medium text-muted-foreground",
          )}
        >
          <p>{format(parseISO(col), "EEE")}</p>
          <p className="text-[11px] font-normal">{format(parseISO(col), "MMM d")}</p>
        </div>
      ))}
    </div>
  );

  return (
    <ConsoleShell
      title="Schedule"
      subtitle="Template preview + weekly grid — click a shift for details"
    >
      <CurrentShiftBanner />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => moveAnchor(-7)}
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-40 text-center text-sm font-medium">{rangeLabel}</span>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => moveAnchor(7)}
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setAnchor(today)}
          disabled={anchor === today}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Today
        </button>
        {canManage ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="size-3.5" />
            Edit schedule
          </Button>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {LEGEND.map(([type, label]) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", shiftCellStyle(type).dot)} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {pattern.isLoading || teams.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : pattern.isError ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="font-medium">Shift pattern isn't available yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              This view needs{" "}
              <code className="font-mono text-xs">GET /plants/&#123;id&#125;/shifts/pattern</code>{" "}
              on the backend. Team rosters are still available below.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {teams.data?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMembersTeam(detailMap.get(t.id) ?? { id: t.id, name: t.name })}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/80"
                >
                  {t.name}
                </button>
              ))}
              {teams.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams configured.</p>
              ) : null}
            </div>
          </div>
          <CyclePreview
            config={{ type: "regular_day", start_hour: 8, end_hour: 17, weekdays_only: true }}
          />
        </div>
      ) : (teams.data ?? []).length === 0 ? (
        <EmptyPlantState
          title="No teams yet"
          description="Shift patterns are generated per team during onboarding (areas, lines, and teams). Configure the plant setup to see the schedule here."
        />
      ) : stripRows.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center">
            <p className="text-sm font-medium">No schedule generated yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Run plant setup to generate the shift template — until then, the default pattern is
              shown below.
            </p>
          </div>
          <CyclePreview
            config={{ type: "regular_day", start_hour: 8, end_hour: 17, weekdays_only: true }}
          />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <ShiftCycleStrip
              caption={`Schedule template — ${rangeLabel}`}
              colDates={cols}
              today={today}
              rows={stripRows}
            />
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[820px]">
              {gridHeader}
              {pattern.data?.teams.map((pt) => {
                const byDate = new Map(pt.days.map((d) => [d.date, d]));
                return (
                  <div
                    key={pt.team_id}
                    className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] items-stretch gap-2 py-1"
                  >
                    <div className="flex min-w-0 flex-col justify-center">
                      <p className="truncate text-sm font-medium">{pt.team_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pt.supervisor_name
                          ? pt.supervisor_name
                          : pt.kind === "track"
                            ? "Crew template"
                            : ""}
                      </p>
                    </div>
                    {cols.map((col) => {
                      const day = byDate.get(col);
                      const type = day?.shift_type ?? null;
                      const style = shiftCellStyle(type);
                      const isCurrent =
                        !!currentShift &&
                        !!day &&
                        pt.team_id === currentShift.team?.id &&
                        col === currentShift.date;
                      let label = "—";
                      if (day && type) label = shiftTypeLetter(type);
                      const hours = day && day.start && day.end ? `${day.start}–${day.end}` : "";
                      return (
                        <button
                          key={col}
                          type="button"
                          disabled={!day}
                          onClick={() => day && openCell(pt, day)}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-center transition-colors",
                            style.cell,
                            col === today && "ring-1 ring-primary/40",
                            isCurrent && "ring-2 ring-success",
                            day
                              ? "hover:border-ring hover:shadow-sm"
                              : "cursor-default opacity-40 hover:shadow-none",
                          )}
                        >
                          <span
                            className={cn(
                              "block truncate text-xs font-semibold",
                              day && type !== "off" && type !== null
                                ? style.text
                                : "text-muted-foreground",
                            )}
                          >
                            {label}
                            {day?.override_id ? (
                              <span className="ml-0.5 text-[9px] opacity-70" title="Overridden">
                                *
                              </span>
                            ) : null}
                          </span>
                          {hours ? (
                            <span className="block text-[11px] text-muted-foreground">{hours}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          {gridLegend.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {gridLegend.map((entry) => (
                <span key={entry.letter} className="flex items-center gap-1.5">
                  <span className={cn("inline-block size-2 rounded-full", entry.dot)} />
                  <span className="font-semibold text-foreground">{entry.letter}</span>
                  {entry.label}
                  {entry.time ? `: ${entry.time}` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}

      {/* Shift detail — click a cell */}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSelected(null)}>
        {sel ? (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{sel.team.team_name}</DialogTitle>
              <DialogDescription>
                {format(parseISO(sel.day.date), "EEEE, MMM d yyyy")}
                {sel.team.supervisor_name ? ` · Supervisor ${sel.team.supervisor_name}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  shiftCellStyle(sel.day.shift_type).cell,
                  shiftCellStyle(sel.day.shift_type).text,
                )}
              >
                {sel.day.shift_type === "off"
                  ? "Off"
                  : (shiftLabel(sel.day.shift_type) ?? "No shift")}
              </span>
              {sel.day.start && sel.day.end ? (
                <span className="text-sm text-muted-foreground">
                  {sel.day.start}–{sel.day.end}
                </span>
              ) : null}
              {sel.day.status ? (
                <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {sel.day.status}
                </span>
              ) : null}
              {sel.day.override_id ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Overridden
                </span>
              ) : null}
            </div>

            {/* Per-day override (supervisor+) */}
            {canManage ? (
              <div className="space-y-2 border-t border-border pt-3">
                {!overrideForm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOverrideForm(true)}
                  >
                    {sel.day.override_id ? "Edit override" : "Override this day"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Day override
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={ovType}
                        onChange={(e) => setOvType(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {OVERRIDE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {ovType !== "off" ? (
                        <>
                          <input
                            type="time"
                            value={`${String(ovStart).padStart(2, "0")}:00`}
                            onChange={(e) => {
                              const h = parseInt(e.target.value.split(":")[0] ?? "0", 10);
                              if (!Number.isNaN(h)) setOvStart(h);
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={`${String(ovEnd).padStart(2, "0")}:00`}
                            onChange={(e) => {
                              const h = parseInt(e.target.value.split(":")[0] ?? "0", 10);
                              if (!Number.isNaN(h)) setOvEnd(h);
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </>
                      ) : null}
                    </div>
                    {(overrides.upsert.error || overrides.remove.error) && (
                      <p role="alert" className="text-xs text-red-600">
                        {overrides.upsert.error instanceof Error
                          ? overrides.upsert.error.message
                          : overrides.remove.error instanceof Error
                            ? overrides.remove.error.message
                            : "Failed to save override"}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {sel.day.override_id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={overrides.remove.isPending}
                          onClick={clearOverride}
                        >
                          Clear override
                        </Button>
                      ) : null}
                      <div className="ml-auto flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOverrideForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={overrides.upsert.isPending}
                          onClick={applyOverride}
                        >
                          {overrides.upsert.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : null}
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {isTrack ? (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Crew template
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generated from the plant's shift pattern. Assign operators to a team to log shifts
                  against this crew.
                </p>
              </div>
            ) : (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Team members
                  {selectedMemberIds.length > 0 ? ` (${selectedMemberIds.length})` : ""}
                </p>
                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                  {selectedDetail?.members?.map((m) => (
                    <li key={m.id} className="truncate text-sm">
                      {m.name} <span className="text-xs text-muted-foreground">· {m.email}</span>
                    </li>
                  ))}
                  {!selectedDetail?.members && selectedMemberIds.length > 0 ? (
                    <li className="text-sm text-muted-foreground">
                      {selectedMemberIds.length} member
                      {selectedMemberIds.length === 1 ? "" : "s"}
                      {teamsDetail.isLoading ? (
                        <Loader2 className="ml-2 inline size-3 animate-spin" />
                      ) : null}
                    </li>
                  ) : null}
                  {selectedMemberIds.length === 0 && !teamsDetail.isLoading ? (
                    <li className="text-sm text-muted-foreground">No members yet.</li>
                  ) : null}
                </ul>
              </div>
            )}

            {!isTrack ? (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    openMembers(
                      selectedDetail ?? {
                        id: sel.team.team_id,
                        name: sel.team.team_name,
                      },
                    )
                  }
                >
                  {canManage ? "Manage members" : "View members"}
                </Button>
              </DialogFooter>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>

      <ScheduleConfigDialog
        plantId={plantId}
        open={configOpen}
        onOpenChange={(o) => setConfigOpen(o)}
      />

      <TeamMembersDialog
        team={membersTeam}
        open={!!membersTeam}
        onOpenChange={(o) => {
          if (!o) setMembersTeam(null);
        }}
      />
    </ConsoleShell>
  );
}
