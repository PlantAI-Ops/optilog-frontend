import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                  types                                     */
/* -------------------------------------------------------------------------- */

export interface AreaData {
  name: string;
  description: string;
}

export interface LineData {
  name: string;
  areaIndex: number;
}

export interface ShiftHours {
  morning: { start: number; end: number };
  afternoon: { start: number; end: number };
  night: { start: number; end: number };
}

export type ShiftConfig =
  | { type: "regular_day"; start_hour: number; end_hour: number; weekdays_only: boolean }
  | { type: "rotating"; pattern: "2-2-2-2" | "3-3-3-3"; hours: ShiftHours }
  | { type: "extended_rotating"; hours: { day: { start: number; end: number }; night: { start: number; end: number } } };

export interface TeamData {
  name: string;
  shift_config: ShiftConfig;
  current_shift?: string | undefined;
  assigned_line_indices?: number[] | undefined;
}

/* -------------------------------------------------------------------------- */
/*                               defaults                                     */
/* -------------------------------------------------------------------------- */

export function defaultShiftConfig(type: string): ShiftConfig {
  switch (type) {
    case "extended_rotating":
      return {
        type: "extended_rotating",
        hours: { day: { start: 7, end: 19 }, night: { start: 19, end: 7 } },
      };
    case "rotating_2222":
      return {
        type: "rotating",
        pattern: "2-2-2-2",
        hours: {
          morning: { start: 6, end: 14 },
          afternoon: { start: 14, end: 22 },
          night: { start: 22, end: 6 },
        },
      };
    case "rotating_3333":
      return {
        type: "rotating",
        pattern: "3-3-3-3",
        hours: {
          morning: { start: 6, end: 14 },
          afternoon: { start: 14, end: 22 },
          night: { start: 22, end: 6 },
        },
      };
    default:
      return { type: "regular_day", start_hour: 8, end_hour: 17, weekdays_only: true };
  }
}

/* -------------------------------------------------------------------------- */
/*                              constants                                     */
/* -------------------------------------------------------------------------- */

export const CUSTOM_SHIFT_NAMES = [
  "Continental",
  "DuPont",
  "4-3",
  "5-2",
  "Southern",
  "Modified Southern",
  "Other",
] as const;

export const SHIFT_TYPES = [
  { key: "regular_day", label: "Regular Day", desc: "8am–5pm, Mon–Fri", teams: 1 },
  { key: "extended_rotating", label: "Extended Day + Night", desc: "3-team rotation: Day → Night → Off", teams: 3 },
  { key: "rotating_2222", label: "Rotating 2-2-2-2", desc: "4-team, 2-day block cycle", teams: 4 },
  { key: "rotating_3333", label: "Rotating 3-3-3-3", desc: "4-team, 3-day block cycle", teams: 4 },
  { key: "custom", label: "Custom", desc: "Build your own schedule", teams: 0 },
] as const;

/* -------------------------------------------------------------------------- */
/*                           overlap detection                                */
/* -------------------------------------------------------------------------- */

function timeRangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  const normalize = (s: number, e: number) => (e <= s ? { start: s, end: e + 24 } : { start: s, end: e });
  const a = normalize(s1, e1);
  const b = normalize(s2, e2);
  return a.start < b.end && b.start < a.end;
}

export function getActiveHours(config: ShiftConfig): { start: number; end: number }[] {
  switch (config.type) {
    case "regular_day":
      return [{ start: config.start_hour, end: config.end_hour }];
    case "rotating":
      return [config.hours.morning, config.hours.afternoon, config.hours.night];
    case "extended_rotating":
      return [config.hours.day, config.hours.night];
  }
}

export function hasTimeOverlap(a: ShiftConfig, b: ShiftConfig): boolean {
  const aHours = getActiveHours(a);
  const bHours = getActiveHours(b);
  for (const ah of aHours) {
    for (const bh of bHours) {
      if (timeRangesOverlap(ah.start, ah.end, bh.start, bh.end)) return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                              helpers                                       */
/* -------------------------------------------------------------------------- */

function formatHour(h: number): string {
  const hour = h % 24;
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function getRotatingSchedule(pattern: "2-2-2-2" | "3-3-3-3", days = 14): string[] {
  const block = pattern === "2-2-2-2" ? 2 : 3;
  const cycle = [
    ...Array(block).fill("M"),
    ...Array(block).fill("A"),
    ...Array(block).fill("N"),
    ...Array(block).fill("-"),
  ];
  const schedule: string[] = [];
  for (let i = 0; i < days; i++) {
    schedule.push(cycle[i % cycle.length]!);
  }
  return schedule;
}

function getExtendedRotatingSchedule(days = 14): string[] {
  const cycle = ["D", "N", "-"];
  const schedule: string[] = [];
  for (let i = 0; i < days; i++) {
    schedule.push(cycle[i % cycle.length]!);
  }
  return schedule;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* -------------------------------------------------------------------------- */
/*                          shift preview component                           */
/* -------------------------------------------------------------------------- */

function RotatingPreview({
  pattern,
  hours,
}: {
  pattern: "2-2-2-2" | "3-3-3-3";
  hours: ShiftHours;
}) {
  const schedule = getRotatingSchedule(pattern, 14);

  const shiftColors: Record<string, string> = {
    M: "bg-blue-100 text-blue-800 border-blue-200",
    A: "bg-amber-100 text-amber-800 border-amber-200",
    N: "bg-indigo-100 text-indigo-800 border-indigo-200",
    "-": "bg-secondary text-muted-foreground border-border",
  };

  const shiftInfo: Record<string, { label: string; time: string }> = {
    M: {
      label: "Morning",
      time: `${formatHour(hours.morning.start)}–${formatHour(hours.morning.end)}`,
    },
    A: {
      label: "Afternoon",
      time: `${formatHour(hours.afternoon.start)}–${formatHour(hours.afternoon.end)}`,
    },
    N: { label: "Night", time: `${formatHour(hours.night.start)}–${formatHour(hours.night.end)}` },
    "-": { label: "Off", time: "Rest day" },
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {pattern} schedule — 14-day preview
      </p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((d) => (
          <div key={`h-${d}`} className="text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {schedule.map((s, i) => (
          <div
            key={i}
            className={`rounded border px-1 py-1 text-[10px] font-semibold ${shiftColors[s] ?? ""}`}
            title={`${shiftInfo[s]?.label ?? ""}: ${shiftInfo[s]?.time ?? ""}`}
          >
            {s}
          </div>
        ))}
        {DAY_LABELS.map((d) => (
          <div key={`h2-${d}`} className="text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> Morning:{" "}
          {formatHour(hours.morning.start)}–{formatHour(hours.morning.end)}
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Afternoon:{" "}
          {formatHour(hours.afternoon.start)}–{formatHour(hours.afternoon.end)}
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" /> Night:{" "}
          {formatHour(hours.night.start)}–{formatHour(hours.night.end)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        time input helper                                   */
/* -------------------------------------------------------------------------- */

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (h: number) => void;
}) {
  const hour = value % 24;
  const display = `${String(hour).padStart(2, "0")}:00`;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <input
        type="time"
        value={display}
        onChange={(e) => {
          const parts = e.target.value.split(":");
          const h = parseInt(parts[0] ?? "0", 10);
          if (!isNaN(h)) onChange(h);
        }}
        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          shift type selector                               */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                           main step 4 component                            */
/* -------------------------------------------------------------------------- */

function TeamsStep({
  teams,
  setTeams,
  areas,
  lines,
  lineShiftMode,
  setLineShiftMode,
  globalShiftType,
  setGlobalShiftType,
  customShiftName,
  setCustomShiftName,
}: {
  teams: TeamData[];
  setTeams: (teams: TeamData[]) => void;
  areas: AreaData[];
  lines: LineData[];
  lineShiftMode: "all" | "per_line";
  setLineShiftMode: (mode: "all" | "per_line") => void;
  globalShiftType: string;
  setGlobalShiftType: (type: string) => void;
  customShiftName: string;
  setCustomShiftName: (name: string) => void;
}) {
  const updateTeamName = (i: number, name: string) => {
    const next = [...teams];
    const team = next[i];
    if (!team) return;
    next[i] = { ...team, name };
    setTeams(next);
  };

  const replaceConfig = (i: number, config: ShiftConfig) => {
    const next = [...teams];
    const team = next[i];
    if (!team) return;
    next[i] = { name: team.name, shift_config: config, current_shift: team.current_shift };
    setTeams(next);
  };

  const setCurrentShift = (i: number, currentShift: string) => {
    const next = [...teams];
    const team = next[i];
    if (!team) return;
    next[i] = { ...team, current_shift: currentShift };
    setTeams(next);
  };

  const toggleLine = (i: number, lineIndex: number) => {
    const next = [...teams];
    const team = next[i];
    if (!team) return;
    const current = team.assigned_line_indices ?? [];
    const updated = current.includes(lineIndex)
      ? current.filter((idx) => idx !== lineIndex)
      : [...current, lineIndex];
    next[i] = { ...team, assigned_line_indices: updated };
    setTeams(next);
  };

  const generateTeams = (shiftType: string): TeamData[] => {
    switch (shiftType) {
      case "regular_day":
        return [{ name: "Team A", shift_config: defaultShiftConfig("regular_day"), assigned_line_indices: [] }];
      case "extended_rotating":
        return [
          { name: "Team A", shift_config: defaultShiftConfig("extended_rotating"), current_shift: "day", assigned_line_indices: [] },
          { name: "Team B", shift_config: defaultShiftConfig("extended_rotating"), current_shift: "night", assigned_line_indices: [] },
          { name: "Team C", shift_config: defaultShiftConfig("extended_rotating"), current_shift: "off", assigned_line_indices: [] },
        ];
      case "rotating_2222":
        return [
          { name: "Team A", shift_config: defaultShiftConfig("rotating_2222"), current_shift: "morning", assigned_line_indices: [] },
          { name: "Team B", shift_config: defaultShiftConfig("rotating_2222"), current_shift: "afternoon", assigned_line_indices: [] },
          { name: "Team C", shift_config: defaultShiftConfig("rotating_2222"), current_shift: "night", assigned_line_indices: [] },
          { name: "Team D", shift_config: defaultShiftConfig("rotating_2222"), current_shift: "off", assigned_line_indices: [] },
        ];
      case "rotating_3333":
        return [
          { name: "Team A", shift_config: defaultShiftConfig("rotating_3333"), current_shift: "morning", assigned_line_indices: [] },
          { name: "Team B", shift_config: defaultShiftConfig("rotating_3333"), current_shift: "afternoon", assigned_line_indices: [] },
          { name: "Team C", shift_config: defaultShiftConfig("rotating_3333"), current_shift: "night", assigned_line_indices: [] },
          { name: "Team D", shift_config: defaultShiftConfig("rotating_3333"), current_shift: "off", assigned_line_indices: [] },
        ];
      default:
        return [{ name: "Team A", shift_config: defaultShiftConfig("regular_day"), assigned_line_indices: [] }];
    }
  };

  const handleShiftTypeChange = (key: string) => {
    setGlobalShiftType(key);
    if (key !== "custom") {
      setTeams(generateTeams(key));
    }
  };

  const handleGlobalHoursChange = (newConfig: ShiftConfig) => {
    setTeams(teams.map((t) => ({ ...t, shift_config: newConfig })));
  };

  const isCustom = globalShiftType === "custom";
  const isRotating = globalShiftType === "rotating_2222" || globalShiftType === "rotating_3333";
  const isExtendedRotating = globalShiftType === "extended_rotating";
  const isGlobalHours = isRotating || isExtendedRotating;

  return (
    <div className="space-y-4">
      {/* Line assignment mode */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Apply shift to</Label>
        <div className="mt-1.5 flex gap-1 rounded-lg border border-border bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => setLineShiftMode("all")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              lineShiftMode === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All lines
          </button>
          <button
            type="button"
            onClick={() => setLineShiftMode("per_line")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              lineShiftMode === "per_line"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Per line
          </button>
        </div>
      </div>

      {/* Line summary */}
      {lines.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Lines:</span>{" "}
            {(() => {
              const grouped = lines.reduce<Record<number, LineData[]>>((acc, line) => {
                (acc[line.areaIndex] ??= []).push(line);
                return acc;
              }, {});
              return Object.entries(grouped)
                .map(([areaIdx, areaLines]) => {
                  const areaName = areas[Number(areaIdx)]?.name || `Area ${Number(areaIdx) + 1}`;
                  return `${areaName} \u203A ${areaLines.map((l) => l.name || "Unnamed").join(", ")}`;
                })
                .join(" | ");
            })()}
          </p>
        </div>
      )}

      {/* Shift type selector */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Shift type</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {SHIFT_TYPES.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => handleShiftTypeChange(st.key)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                globalShiftType === st.key
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <p className="text-xs font-semibold">{st.label}</p>
              <p className="text-[10px] text-muted-foreground">{st.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom shift name */}
      {isCustom && (
        <div>
          <Label htmlFor="custom-shift-name">Shift type name</Label>
          <select
            id="custom-shift-name"
            value={customShiftName}
            onChange={(e) => setCustomShiftName(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select a name...</option>
            {CUSTOM_SHIFT_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Global hours section for rotating/extended types */}
      {isGlobalHours && teams.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Shift hours (applies to all teams)</p>
          {isExtendedRotating && (() => {
            const cfg = teams[0]?.shift_config;
            if (cfg?.type !== "extended_rotating") return null;
            return (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <TimeInput
                    label="Day start"
                    value={cfg.hours.day.start}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "extended_rotating",
                        hours: { ...cfg.hours, day: { ...cfg.hours.day, start: h } },
                      })
                    }
                  />
                  <TimeInput
                    label="Day end"
                    value={cfg.hours.day.end}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "extended_rotating",
                        hours: { ...cfg.hours, day: { ...cfg.hours.day, end: h } },
                      })
                    }
                  />
                  <TimeInput
                    label="Night start"
                    value={cfg.hours.night.start}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "extended_rotating",
                        hours: { ...cfg.hours, night: { ...cfg.hours.night, start: h } },
                      })
                    }
                  />
                  <TimeInput
                    label="Night end"
                    value={cfg.hours.night.end}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "extended_rotating",
                        hours: { ...cfg.hours, night: { ...cfg.hours.night, end: h } },
                      })
                    }
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Pattern: Day → Night → Off (repeating)
                </p>
              </>
            );
          })()}
          {isRotating && (() => {
            const cfg = teams[0]?.shift_config;
            if (cfg?.type !== "rotating") return null;
            return (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleGlobalHoursChange({ type: "rotating", pattern: "2-2-2-2", hours: cfg.hours })
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      cfg.pattern === "2-2-2-2"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    2-2-2-2
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGlobalHoursChange({ type: "rotating", pattern: "3-3-3-3", hours: cfg.hours })
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      cfg.pattern === "3-3-3-3"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    3-3-3-3
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <TimeInput
                    label="Morning start"
                    value={cfg.hours.morning.start}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "rotating",
                        pattern: cfg.pattern,
                        hours: { ...cfg.hours, morning: { ...cfg.hours.morning, start: h } },
                      })
                    }
                  />
                  <TimeInput
                    label="Morning end"
                    value={cfg.hours.morning.end}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "rotating",
                        pattern: cfg.pattern,
                        hours: { ...cfg.hours, morning: { ...cfg.hours.morning, end: h } },
                      })
                    }
                  />
                  <span className="self-center text-[10px] text-muted-foreground">
                    {formatHour(cfg.hours.morning.start)}–{formatHour(cfg.hours.morning.end)}
                  </span>
                  <TimeInput
                    label="Afternoon start"
                    value={cfg.hours.afternoon.start}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "rotating",
                        pattern: cfg.pattern,
                        hours: { ...cfg.hours, afternoon: { ...cfg.hours.afternoon, start: h } },
                      })
                    }
                  />
                  <TimeInput
                    label="Afternoon end"
                    value={cfg.hours.afternoon.end}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "rotating",
                        pattern: cfg.pattern,
                        hours: { ...cfg.hours, afternoon: { ...cfg.hours.afternoon, end: h } },
                      })
                    }
                  />
                  <span className="self-center text-[10px] text-muted-foreground">
                    {formatHour(cfg.hours.afternoon.start)}–{formatHour(cfg.hours.afternoon.end)}
                  </span>
                  <TimeInput
                    label="Night start"
                    value={cfg.hours.night.start}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "rotating",
                        pattern: cfg.pattern,
                        hours: { ...cfg.hours, night: { ...cfg.hours.night, start: h } },
                      })
                    }
                  />
                  <TimeInput
                    label="Night end"
                    value={cfg.hours.night.end}
                    onChange={(h) =>
                      handleGlobalHoursChange({
                        type: "rotating",
                        pattern: cfg.pattern,
                        hours: { ...cfg.hours, night: { ...cfg.hours.night, end: h } },
                      })
                    }
                  />
                  <span className="self-center text-[10px] text-muted-foreground">
                    {formatHour(cfg.hours.night.start)}–{formatHour(cfg.hours.night.end)}
                  </span>
                </div>
                <RotatingPreview pattern={cfg.pattern} hours={cfg.hours} />
              </>
            );
          })()}
        </div>
      )}

      {/* Team cards */}
      <div className="space-y-3">
        {teams.map((team, i) => {
          const cfg = team.shift_config;

          // Compute which shifts are taken by OTHER teams
          const takenShifts = new Set(
            teams
              .map((t, j) => (j !== i ? t.current_shift : undefined))
              .filter((s): s is string => !!s)
          );
          const hasConflict = !!team.current_shift && takenShifts.has(team.current_shift);

          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border bg-card p-4 space-y-3",
                hasConflict ? "border-red-500" : "border-border"
              )}
            >
              {/* Team name + remove */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="sr-only">Team name</Label>
                  <Input
                    placeholder="Team name"
                    value={team.name}
                    onChange={(e) => updateTeamName(i, e.target.value)}
                  />
                </div>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => setTeams(teams.filter((_, j) => j !== i))}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Current shift selector for rotating/extended types */}
              {isGlobalHours && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Current shift</Label>
                  {isExtendedRotating && (
                    <select
                      value={team.current_shift ?? "day"}
                      onChange={(e) => setCurrentShift(i, e.target.value)}
                      className={cn(
                        "flex h-8 rounded-md border bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        hasConflict ? "border-red-500" : "border-input"
                      )}
                    >
                      <option value="day" disabled={takenShifts.has("day") && team.current_shift !== "day"}>
                        Day
                      </option>
                      <option value="night" disabled={takenShifts.has("night") && team.current_shift !== "night"}>
                        Night
                      </option>
                      <option value="off" disabled={takenShifts.has("off") && team.current_shift !== "off"}>
                        Off
                      </option>
                    </select>
                  )}
                  {isRotating && (
                    <select
                      value={team.current_shift ?? "morning"}
                      onChange={(e) => setCurrentShift(i, e.target.value)}
                      className={cn(
                        "flex h-8 rounded-md border bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        hasConflict ? "border-red-500" : "border-input"
                      )}
                    >
                      <option value="morning" disabled={takenShifts.has("morning") && team.current_shift !== "morning"}>
                        Morning
                      </option>
                      <option value="afternoon" disabled={takenShifts.has("afternoon") && team.current_shift !== "afternoon"}>
                        Afternoon
                      </option>
                      <option value="night" disabled={takenShifts.has("night") && team.current_shift !== "night"}>
                        Night
                      </option>
                      <option value="off" disabled={takenShifts.has("off") && team.current_shift !== "off"}>
                        Off
                      </option>
                    </select>
                  )}
                </div>
              )}

              {/* Line assignment */}
              {lines.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {lineShiftMode === "all" ? "Lines" : "Assign lines"}
                  </Label>
                  {lineShiftMode === "all" ? (
                    <p className="text-xs text-foreground">All lines</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {lines.map((line, li) => {
                        const assigned = team.assigned_line_indices ?? [];
                        const isChecked = assigned.includes(li);
                        const areaName = areas[line.areaIndex]?.name || `Area ${line.areaIndex + 1}`;
                        return (
                          <label
                            key={li}
                            className={cn(
                              "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                              isChecked
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleLine(i, li)}
                              className="accent-primary"
                            />
                            {areaName} › {line.name || `Line ${li + 1}`}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Config panel — regular_day */}
              {cfg.type === "regular_day" && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-3">
                  <TimeInput
                    label="Start"
                    value={cfg.start_hour}
                    onChange={(h) =>
                      replaceConfig(i, {
                        type: "regular_day",
                        start_hour: h,
                        end_hour: cfg.end_hour,
                        weekdays_only: cfg.weekdays_only,
                      })
                    }
                  />
                  <TimeInput
                    label="End"
                    value={cfg.end_hour}
                    onChange={(h) =>
                      replaceConfig(i, {
                        type: "regular_day",
                        start_hour: cfg.start_hour,
                        end_hour: h,
                        weekdays_only: cfg.weekdays_only,
                      })
                    }
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={cfg.weekdays_only}
                      onChange={(e) =>
                        replaceConfig(i, {
                          type: "regular_day",
                          start_hour: cfg.start_hour,
                          end_hour: cfg.end_hour,
                          weekdays_only: e.target.checked,
                        })
                      }
                      className="accent-primary"
                    />
                    Weekdays only
                  </label>
                </div>
              )}

              {/* Config panel — custom (per-team shift type + times) */}
              {isCustom && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {SHIFT_TYPES.filter((st) => st.key !== "custom").map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => replaceConfig(i, defaultShiftConfig(st.key))}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${
                          cfg.type === st.key.replace("rotating_2222", "rotating").replace("rotating_3333", "rotating")
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                  {cfg.type === "regular_day" && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2">
                      <TimeInput
                        label="Start"
                        value={cfg.start_hour}
                        onChange={(h) =>
                          replaceConfig(i, { ...cfg, start_hour: h })
                        }
                      />
                      <TimeInput
                        label="End"
                        value={cfg.end_hour}
                        onChange={(h) =>
                          replaceConfig(i, { ...cfg, end_hour: h })
                        }
                      />
                    </div>
                  )}
                  {cfg.type === "extended_rotating" && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2">
                      <TimeInput
                        label="Day start"
                        value={cfg.hours.day.start}
                        onChange={(h) =>
                          replaceConfig(i, {
                            type: "extended_rotating",
                            hours: { ...cfg.hours, day: { ...cfg.hours.day, start: h } },
                          })
                        }
                      />
                      <TimeInput
                        label="Day end"
                        value={cfg.hours.day.end}
                        onChange={(h) =>
                          replaceConfig(i, {
                            type: "extended_rotating",
                            hours: { ...cfg.hours, day: { ...cfg.hours.day, end: h } },
                          })
                        }
                      />
                      <TimeInput
                        label="Night start"
                        value={cfg.hours.night.start}
                        onChange={(h) =>
                          replaceConfig(i, {
                            type: "extended_rotating",
                            hours: { ...cfg.hours, night: { ...cfg.hours.night, start: h } },
                          })
                        }
                      />
                      <TimeInput
                        label="Night end"
                        value={cfg.hours.night.end}
                        onChange={(h) =>
                          replaceConfig(i, {
                            type: "extended_rotating",
                            hours: { ...cfg.hours, night: { ...cfg.hours.night, end: h } },
                          })
                        }
                      />
                    </div>
                  )}
                  {cfg.type === "rotating" && (
                    <div className="space-y-2 rounded-lg border border-border p-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => replaceConfig(i, { type: "rotating", pattern: "2-2-2-2", hours: cfg.hours })}
                          className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
                            cfg.pattern === "2-2-2-2"
                              ? "border-primary bg-primary/5"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          2-2-2-2
                        </button>
                        <button
                          type="button"
                          onClick={() => replaceConfig(i, { type: "rotating", pattern: "3-3-3-3", hours: cfg.hours })}
                          className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
                            cfg.pattern === "3-3-3-3"
                              ? "border-primary bg-primary/5"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          3-3-3-3
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <TimeInput label="M start" value={cfg.hours.morning.start} onChange={(h) => replaceConfig(i, { type: "rotating", pattern: cfg.pattern, hours: { ...cfg.hours, morning: { ...cfg.hours.morning, start: h } } })} />
                        <TimeInput label="M end" value={cfg.hours.morning.end} onChange={(h) => replaceConfig(i, { type: "rotating", pattern: cfg.pattern, hours: { ...cfg.hours, morning: { ...cfg.hours.morning, end: h } } })} />
                        <span className="self-center text-[10px] text-muted-foreground">{formatHour(cfg.hours.morning.start)}–{formatHour(cfg.hours.morning.end)}</span>
                        <TimeInput label="A start" value={cfg.hours.afternoon.start} onChange={(h) => replaceConfig(i, { type: "rotating", pattern: cfg.pattern, hours: { ...cfg.hours, afternoon: { ...cfg.hours.afternoon, start: h } } })} />
                        <TimeInput label="A end" value={cfg.hours.afternoon.end} onChange={(h) => replaceConfig(i, { type: "rotating", pattern: cfg.pattern, hours: { ...cfg.hours, afternoon: { ...cfg.hours.afternoon, end: h } } })} />
                        <span className="self-center text-[10px] text-muted-foreground">{formatHour(cfg.hours.afternoon.start)}–{formatHour(cfg.hours.afternoon.end)}</span>
                        <TimeInput label="N start" value={cfg.hours.night.start} onChange={(h) => replaceConfig(i, { type: "rotating", pattern: cfg.pattern, hours: { ...cfg.hours, night: { ...cfg.hours.night, start: h } } })} />
                        <TimeInput label="N end" value={cfg.hours.night.end} onChange={(h) => replaceConfig(i, { type: "rotating", pattern: cfg.pattern, hours: { ...cfg.hours, night: { ...cfg.hours.night, end: h } } })} />
                        <span className="self-center text-[10px] text-muted-foreground">{formatHour(cfg.hours.night.start)}–{formatHour(cfg.hours.night.end)}</span>
                      </div>
                      <RotatingPreview pattern={cfg.pattern} hours={cfg.hours} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add team (custom mode only) */}
      {isCustom && (
        <button
          type="button"
          onClick={() =>
            setTeams([...teams, { name: "", shift_config: defaultShiftConfig("regular_day"), assigned_line_indices: [] }])
          }
          className="rounded-lg border border-dashed border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
        >
          + Add Team
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           exported form component                          */
/* -------------------------------------------------------------------------- */

export function PlantSetupForm({
  areas,
  setAreas,
  lines,
  setLines,
  teams,
  setTeams,
  step,
  lineShiftMode,
  setLineShiftMode,
  globalShiftType,
  setGlobalShiftType,
  customShiftName,
  setCustomShiftName,
}: {
  areas: AreaData[];
  setAreas: (areas: AreaData[]) => void;
  lines: LineData[];
  setLines: (lines: LineData[]) => void;
  teams: TeamData[];
  setTeams: (teams: TeamData[]) => void;
  step: 2 | 3 | 4;
  lineShiftMode: "all" | "per_line";
  setLineShiftMode: (mode: "all" | "per_line") => void;
  globalShiftType: string;
  setGlobalShiftType: (type: string) => void;
  customShiftName: string;
  setCustomShiftName: (name: string) => void;
}) {
  if (step === 2) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Define the production areas in your plant. Each area groups related production lines.
        </p>
        {areas.map((area, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex-1">
              <Label className="sr-only">Area name</Label>
              <Input
                placeholder="Area name"
                value={area.name}
                onChange={(e) => {
                  const next = [...areas];
                  next[i] = { name: e.target.value, description: area.description };
                  setAreas(next);
                }}
              />
            </div>
            <div className="flex-1">
              <Label className="sr-only">Description</Label>
              <Input
                placeholder="Description (optional)"
                value={area.description}
                onChange={(e) => {
                  const next = [...areas];
                  next[i] = { name: area.name, description: e.target.value };
                  setAreas(next);
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setAreas(areas.filter((_, j) => j !== i))}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAreas([...areas, { name: "", description: "" }])}
          className="rounded-lg border border-dashed border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
        >
          + Add Area
        </button>
      </div>
    );
  }

  if (step === 3) {
    const firstAreaCount = lines.filter((l) => l.areaIndex === 0).length || 1;

    const setAllCounts = (newCount: number) => {
      const n = Math.max(1, Math.min(newCount, 50));
      const allLines: LineData[] = [];
      for (let areaIdx = 0; areaIdx < areas.length; areaIdx++) {
        for (let i = 0; i < n; i++) {
          const existing = lines.find((l) => l.areaIndex === areaIdx && l.name === `Line-${i + 1}`);
          allLines.push({ name: existing?.name ?? `Line-${i + 1}`, areaIndex: areaIdx });
        }
      }
      setLines(allLines);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="lines-per-area" className="text-sm text-muted-foreground">
            Lines per area
          </Label>
          <input
            id="lines-per-area"
            type="number"
            min={1}
            max={50}
            value={firstAreaCount}
            onChange={(e) => setAllCounts(parseInt(e.target.value, 10) || 1)}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {areas.map((area, areaIdx) => {
          const areaLines = lines.filter((l) => l.areaIndex === areaIdx);
          return (
            <div key={areaIdx} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{area.name || `Area ${areaIdx + 1}`}</p>
              <div className="mt-2 space-y-1.5">
                {areaLines.map((line, lineIdx) => {
                  const globalIdx = lines.indexOf(line);
                  return (
                    <div key={lineIdx} className="flex items-center gap-2">
                      <span className="w-6 text-right text-xs text-muted-foreground">
                        {lineIdx + 1}.
                      </span>
                      <Input
                        placeholder={`Line-${lineIdx + 1}`}
                        value={line.name}
                        onChange={(e) => {
                          const next = [...lines];
                          next[globalIdx] = { name: e.target.value, areaIndex: line.areaIndex };
                          setLines(next);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // step === 4
  return (
    <TeamsStep
      teams={teams}
      setTeams={setTeams}
      areas={areas}
      lines={lines}
      lineShiftMode={lineShiftMode}
      setLineShiftMode={setLineShiftMode}
      globalShiftType={globalShiftType}
      setGlobalShiftType={setGlobalShiftType}
      customShiftName={customShiftName}
      setCustomShiftName={setCustomShiftName}
    />
  );
}
