import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  | { type: "extended_day"; start_hour: number; end_hour: number }
  | { type: "night"; start_hour: number; end_hour: number }
  | { type: "rotating"; pattern: "2-2-2-2" | "3-3-3-3"; hours: ShiftHours };

export interface TeamData {
  name: string;
  shift_config: ShiftConfig;
}

/* -------------------------------------------------------------------------- */
/*                               defaults                                     */
/* -------------------------------------------------------------------------- */

export function defaultShiftConfig(type: string): ShiftConfig {
  switch (type) {
    case "extended_day":
      return { type: "extended_day", start_hour: 7, end_hour: 19 };
    case "night":
      return { type: "night", start_hour: 19, end_hour: 7 };
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
  const cycle = ["M", "M", "A", "A", "N", "N", ...Array(block).fill("-")];
  const schedule: string[] = [];
  for (let i = 0; i < days; i++) {
    schedule.push(cycle[i % cycle.length]);
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
        className="flex h-8 w-24 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          shift type selector                               */
/* -------------------------------------------------------------------------- */

const SHIFT_TYPES = [
  { key: "regular_day", label: "Regular Day", desc: "8am–5pm, Mon–Fri" },
  { key: "extended_day", label: "Extended Day", desc: "7am–7pm, 7 days/week" },
  { key: "night", label: "Night", desc: "7pm–7pm, 7 days/week" },
  { key: "rotating", label: "Rotating", desc: "Day/Afternoon/Night/Off cycle" },
] as const;

function getShiftTypeKey(config: ShiftConfig): string {
  if (config.type === "rotating") return "rotating";
  return config.type;
}

/* -------------------------------------------------------------------------- */
/*                           main step 4 component                            */
/* -------------------------------------------------------------------------- */

function TeamsStep({
  teams,
  setTeams,
}: {
  teams: TeamData[];
  setTeams: (teams: TeamData[]) => void;
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
    next[i] = { name: team.name, shift_config: config };
    setTeams(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Define teams and their shift schedules.</p>

      {teams.map((team, i) => {
        const activeType = getShiftTypeKey(team.shift_config);
        const cfg = team.shift_config;

        return (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
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
              <button
                type="button"
                onClick={() => setTeams(teams.filter((_, j) => j !== i))}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                Remove
              </button>
            </div>

            {/* Shift type selector */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Shift Type</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {SHIFT_TYPES.map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      if (st.key !== activeType) {
                        replaceConfig(
                          i,
                          defaultShiftConfig(st.key === "rotating" ? "rotating_2222" : st.key),
                        );
                      }
                    }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      activeType === st.key
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

            {/* Config panel */}
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

            {cfg.type === "extended_day" && (
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-3">
                <TimeInput
                  label="Start"
                  value={cfg.start_hour}
                  onChange={(h) =>
                    replaceConfig(i, {
                      type: "extended_day",
                      start_hour: h,
                      end_hour: cfg.end_hour,
                    })
                  }
                />
                <TimeInput
                  label="End"
                  value={cfg.end_hour}
                  onChange={(h) =>
                    replaceConfig(i, {
                      type: "extended_day",
                      start_hour: cfg.start_hour,
                      end_hour: h,
                    })
                  }
                />
                <span className="text-[10px] text-muted-foreground">
                  7 days/week (weekends inclusive)
                </span>
              </div>
            )}

            {cfg.type === "night" && (
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-3">
                <TimeInput
                  label="Start"
                  value={cfg.start_hour}
                  onChange={(h) =>
                    replaceConfig(i, { type: "night", start_hour: h, end_hour: cfg.end_hour })
                  }
                />
                <TimeInput
                  label="End"
                  value={cfg.end_hour}
                  onChange={(h) =>
                    replaceConfig(i, { type: "night", start_hour: cfg.start_hour, end_hour: h })
                  }
                />
                <span className="text-[10px] text-muted-foreground">
                  7 days/week (weekends inclusive)
                </span>
              </div>
            )}

            {cfg.type === "rotating" && (
              <div className="space-y-3">
                {/* Pattern selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      replaceConfig(i, { type: "rotating", pattern: "2-2-2-2", hours: cfg.hours })
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
                      replaceConfig(i, { type: "rotating", pattern: "3-3-3-3", hours: cfg.hours })
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

                {/* Time block editor */}
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Time Blocks</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <TimeInput
                      label="Morning start"
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
                      label="Morning end"
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
                      label="Afternoon start"
                      value={cfg.hours.afternoon.start}
                      onChange={(h) =>
                        replaceConfig(i, {
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
                        replaceConfig(i, {
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
                        replaceConfig(i, {
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
                </div>

                {/* Schedule preview */}
                <RotatingPreview pattern={cfg.pattern} hours={cfg.hours} />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          setTeams([...teams, { name: "", shift_config: defaultShiftConfig("regular_day") }])
        }
        className="rounded-lg border border-dashed border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
      >
        + Add Team
      </button>
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
}: {
  areas: AreaData[];
  setAreas: (areas: AreaData[]) => void;
  lines: LineData[];
  setLines: (lines: LineData[]) => void;
  teams: TeamData[];
  setTeams: (teams: TeamData[]) => void;
  step: 2 | 3 | 4;
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
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Add production lines within each area.</p>
        {areas.map((area, areaIdx) => {
          const areaLines = lines.filter((l) => l.areaIndex === areaIdx);
          return (
            <div key={areaIdx} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{area.name || `Area ${areaIdx + 1}`}</p>
              <div className="mt-2 space-y-2">
                {areaLines.map((line, lineIdx) => {
                  const globalIdx = lines.indexOf(line);
                  return (
                    <div key={lineIdx} className="flex gap-2">
                      <Input
                        placeholder="Line name"
                        value={line.name}
                        onChange={(e) => {
                          const next = [...lines];
                          next[globalIdx] = { name: e.target.value, areaIndex: line.areaIndex };
                          setLines(next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setLines(lines.filter((_, j) => j !== globalIdx))}
                        className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setLines([...lines, { name: "", areaIndex: areaIdx }])}
                className="mt-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60"
              >
                + Add Line
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // step === 4
  return <TeamsStep teams={teams} setTeams={setTeams} />;
}
