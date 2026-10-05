import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Copy } from "lucide-react";
import { useState } from "react";
import { useTenantPlants } from "@/lib/admin-hooks";
import { api } from "@/lib/api";
import type { AdminPlant } from "@/lib/shift-log";
import { CyclePreview, formatHour } from "@/components/ShiftCycleStrip";

function normalizeArrayResponse<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const envelope = response as { items?: T[]; data?: T[] } | null | undefined;
  return envelope?.items ?? envelope?.data ?? [];
}

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
  | {
      type: "extended_rotating";
      hours: { day: { start: number; end: number }; night: { start: number; end: number } };
    };

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
  {
    key: "extended_rotating",
    label: "Extended Day + Night",
    desc: "3-team rotation: Day → Night → Off",
    teams: 3,
  },
  { key: "rotating_2222", label: "Rotating 2-2-2-2", desc: "4-team, 2-day block cycle", teams: 4 },
  { key: "rotating_3333", label: "Rotating 3-3-3-3", desc: "4-team, 3-day block cycle", teams: 4 },
  { key: "custom", label: "Custom", desc: "Build your own schedule", teams: 0 },
] as const;

/* -------------------------------------------------------------------------- */
/*                           overlap detection                                */
/* -------------------------------------------------------------------------- */

function timeRangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  const normalize = (s: number, e: number) =>
    e <= s ? { start: s, end: e + 24 } : { start: s, end: e };
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
/*                              shift preview                                  */
/* -------------------------------------------------------------------------- */

/* Cycle visuals live in @/components/ShiftCycleStrip (shared with Schedule). */

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
    next[i] = { ...team, shift_config: config };
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
        return [
          {
            name: "Team A",
            shift_config: defaultShiftConfig("regular_day"),
            assigned_line_indices: [],
          },
        ];
      case "extended_rotating":
        return [
          {
            name: "Team A",
            shift_config: defaultShiftConfig("extended_rotating"),
            current_shift: "day",
            assigned_line_indices: [],
          },
          {
            name: "Team B",
            shift_config: defaultShiftConfig("extended_rotating"),
            current_shift: "night",
            assigned_line_indices: [],
          },
          {
            name: "Team C",
            shift_config: defaultShiftConfig("extended_rotating"),
            current_shift: "off",
            assigned_line_indices: [],
          },
        ];
      case "rotating_2222":
        return [
          {
            name: "Team A",
            shift_config: defaultShiftConfig("rotating_2222"),
            current_shift: "morning",
            assigned_line_indices: [],
          },
          {
            name: "Team B",
            shift_config: defaultShiftConfig("rotating_2222"),
            current_shift: "afternoon",
            assigned_line_indices: [],
          },
          {
            name: "Team C",
            shift_config: defaultShiftConfig("rotating_2222"),
            current_shift: "night",
            assigned_line_indices: [],
          },
          {
            name: "Team D",
            shift_config: defaultShiftConfig("rotating_2222"),
            current_shift: "off",
            assigned_line_indices: [],
          },
        ];
      case "rotating_3333":
        return [
          {
            name: "Team A",
            shift_config: defaultShiftConfig("rotating_3333"),
            current_shift: "morning",
            assigned_line_indices: [],
          },
          {
            name: "Team B",
            shift_config: defaultShiftConfig("rotating_3333"),
            current_shift: "afternoon",
            assigned_line_indices: [],
          },
          {
            name: "Team C",
            shift_config: defaultShiftConfig("rotating_3333"),
            current_shift: "night",
            assigned_line_indices: [],
          },
          {
            name: "Team D",
            shift_config: defaultShiftConfig("rotating_3333"),
            current_shift: "off",
            assigned_line_indices: [],
          },
        ];
      default:
        return [
          {
            name: "Team A",
            shift_config: defaultShiftConfig("regular_day"),
            assigned_line_indices: [],
          },
        ];
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
            {lines.map((line) => line.name || "Unnamed").join(", ")}
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
          {isExtendedRotating &&
            (() => {
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
                  <CyclePreview config={cfg} teams={teams} />
                </>
              );
            })()}
          {isRotating &&
            (() => {
              const cfg = teams[0]?.shift_config;
              if (cfg?.type !== "rotating") return null;
              return (
                <>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleGlobalHoursChange({
                          type: "rotating",
                          pattern: "2-2-2-2",
                          hours: cfg.hours,
                        })
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
                        handleGlobalHoursChange({
                          type: "rotating",
                          pattern: "3-3-3-3",
                          hours: cfg.hours,
                        })
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
                  <CyclePreview config={cfg} teams={teams} />
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
              .filter((s): s is string => !!s),
          );
          const hasConflict = !!team.current_shift && takenShifts.has(team.current_shift);

          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border bg-card p-4 space-y-3",
                hasConflict ? "border-red-500" : "border-border",
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
                        hasConflict ? "border-red-500" : "border-input",
                      )}
                    >
                      <option
                        value="day"
                        disabled={takenShifts.has("day") && team.current_shift !== "day"}
                      >
                        Day
                      </option>
                      <option
                        value="night"
                        disabled={takenShifts.has("night") && team.current_shift !== "night"}
                      >
                        Night
                      </option>
                      <option
                        value="off"
                        disabled={takenShifts.has("off") && team.current_shift !== "off"}
                      >
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
                        hasConflict ? "border-red-500" : "border-input",
                      )}
                    >
                      <option
                        value="morning"
                        disabled={takenShifts.has("morning") && team.current_shift !== "morning"}
                      >
                        Morning
                      </option>
                      <option
                        value="afternoon"
                        disabled={
                          takenShifts.has("afternoon") && team.current_shift !== "afternoon"
                        }
                      >
                        Afternoon
                      </option>
                      <option
                        value="night"
                        disabled={takenShifts.has("night") && team.current_shift !== "night"}
                      >
                        Night
                      </option>
                      <option
                        value="off"
                        disabled={takenShifts.has("off") && team.current_shift !== "off"}
                      >
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
                        return (
                          <label
                            key={li}
                            className={cn(
                              "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                              isChecked
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleLine(i, li)}
                              className="accent-primary"
                            />
                            {line.name || `Line ${li + 1}`}
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

              {cfg.type === "regular_day" && <CyclePreview config={cfg} teams={teams} />}

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
                          cfg.type ===
                          st.key
                            .replace("rotating_2222", "rotating")
                            .replace("rotating_3333", "rotating")
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
                        onChange={(h) => replaceConfig(i, { ...cfg, start_hour: h })}
                      />
                      <TimeInput
                        label="End"
                        value={cfg.end_hour}
                        onChange={(h) => replaceConfig(i, { ...cfg, end_hour: h })}
                      />
                    </div>
                  )}
                  {cfg.type === "regular_day" && <CyclePreview config={cfg} teams={teams} />}
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
                  {cfg.type === "extended_rotating" && <CyclePreview config={cfg} teams={teams} />}
                  {cfg.type === "rotating" && (
                    <div className="space-y-2 rounded-lg border border-border p-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            replaceConfig(i, {
                              type: "rotating",
                              pattern: "2-2-2-2",
                              hours: cfg.hours,
                            })
                          }
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
                          onClick={() =>
                            replaceConfig(i, {
                              type: "rotating",
                              pattern: "3-3-3-3",
                              hours: cfg.hours,
                            })
                          }
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
                        <TimeInput
                          label="M start"
                          value={cfg.hours.morning.start}
                          onChange={(h) =>
                            replaceConfig(i, {
                              type: "rotating",
                              pattern: cfg.pattern,
                              hours: { ...cfg.hours, morning: { ...cfg.hours.morning, start: h } },
                            })
                          }
                        />
                        <TimeInput
                          label="M end"
                          value={cfg.hours.morning.end}
                          onChange={(h) =>
                            replaceConfig(i, {
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
                          label="A start"
                          value={cfg.hours.afternoon.start}
                          onChange={(h) =>
                            replaceConfig(i, {
                              type: "rotating",
                              pattern: cfg.pattern,
                              hours: {
                                ...cfg.hours,
                                afternoon: { ...cfg.hours.afternoon, start: h },
                              },
                            })
                          }
                        />
                        <TimeInput
                          label="A end"
                          value={cfg.hours.afternoon.end}
                          onChange={(h) =>
                            replaceConfig(i, {
                              type: "rotating",
                              pattern: cfg.pattern,
                              hours: {
                                ...cfg.hours,
                                afternoon: { ...cfg.hours.afternoon, end: h },
                              },
                            })
                          }
                        />
                        <span className="self-center text-[10px] text-muted-foreground">
                          {formatHour(cfg.hours.afternoon.start)}–
                          {formatHour(cfg.hours.afternoon.end)}
                        </span>
                        <TimeInput
                          label="N start"
                          value={cfg.hours.night.start}
                          onChange={(h) =>
                            replaceConfig(i, {
                              type: "rotating",
                              pattern: cfg.pattern,
                              hours: { ...cfg.hours, night: { ...cfg.hours.night, start: h } },
                            })
                          }
                        />
                        <TimeInput
                          label="N end"
                          value={cfg.hours.night.end}
                          onChange={(h) =>
                            replaceConfig(i, {
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
                      <CyclePreview config={cfg} teams={teams} />
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
            setTeams([
              ...teams,
              {
                name: "",
                shift_config: defaultShiftConfig("regular_day"),
                assigned_line_indices: [],
              },
            ])
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
  tenantId,
  plantId,
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
  tenantId: string;
  plantId?: string;
}) {
  const { data: tenantPlants } = useTenantPlants(tenantId);
  const [copyFromPlantId, setCopyFromPlantId] = useState<string>("");
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyAreas = async () => {
    if (!copyFromPlantId) return;
    setIsCopying(true);
    try {
      const res = await api.get<unknown>(`/plants/${copyFromPlantId}/areas`);
      const copiedAreas = normalizeArrayResponse<{ name: string; description?: string }>(res).map(
        (a) => ({
          name: a.name,
          description: a.description ?? "",
        }),
      );
      setAreas(copiedAreas);
      setCopyFromPlantId("");
    } catch (e) {
      // Error handled silently or could add toast
    } finally {
      setIsCopying(false);
    }
  };

  if (step === 2) {
    const tenantPlantsLoaded = tenantPlants !== undefined;
    const otherPlants = tenantPlantsLoaded
      ? (tenantPlants as AdminPlant[]).filter((p) => p.id !== plantId)
      : [];

    return (
      <div className="space-y-3">
        {tenantPlantsLoaded && tenantPlants.length > 1 && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Copy from existing plant</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Copy areas from another plant in this tenant to get started quickly.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={copyFromPlantId}
                  onChange={(e) => setCopyFromPlantId(e.target.value)}
                  className="flex-1 min-w-[200px] h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  disabled={isCopying}
                >
                  <option value="">Select plant to copy areas from...</option>
                  {otherPlants.map((p: AdminPlant) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleCopyAreas}
                  disabled={!copyFromPlantId || isCopying}
                  size="sm"
                >
                  {isCopying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy Areas
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Define the zones of your plant. Each area is a zone that your production lines run
          through.
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
    const setLineCount = (newCount: number) => {
      const n = Math.max(1, Math.min(newCount, 50));
      const next: LineData[] = [];
      for (let i = 0; i < n; i++) {
        next.push({ name: lines[i]?.name ?? `Line-${i + 1}`, areaIndex: 0 });
      }
      setLines(next);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="line-count" className="text-sm text-muted-foreground">
            Number of lines
          </Label>
          <input
            id="line-count"
            type="number"
            min={1}
            max={50}
            value={lines.length}
            onChange={(e) => setLineCount(parseInt(e.target.value, 10) || 1)}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Your {areas.length} {areas.length === 1 ? "area is a zone" : "areas are zones"} the{" "}
          {lines.length === 1 ? "line runs" : "lines run"} through — the count above is the plant's
          total line count.
        </p>
        <div className="space-y-1.5">
          {lines.map((line, li) => (
            <div key={li} className="flex items-center gap-2">
              <span className="w-6 text-right text-xs text-muted-foreground">{li + 1}.</span>
              <Input
                placeholder={`Line-${li + 1}`}
                value={line.name}
                onChange={(e) => {
                  const next = [...lines];
                  next[li] = { name: e.target.value, areaIndex: line.areaIndex };
                  setLines(next);
                }}
              />
            </div>
          ))}
        </div>
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
