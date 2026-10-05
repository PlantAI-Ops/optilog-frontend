import { Fragment } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { shiftLabel, shiftTypeLetter, LETTER_STYLES, LETTER_DOTS, LETTER_LABELS } from "@/lib/shift-now";

/* -------------------------------------------------------------------------- */
/*                                  helpers                                    */
/* -------------------------------------------------------------------------- */

/** Hour number -> "6 AM" / "12 PM" (used by onboarding previews + legends). */
export function formatHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function rotatingBlock(pattern: "2-2-2-2" | "3-3-3-3"): number {
  return pattern === "2-2-2-2" ? 2 : 3;
}

/* -------------------------------------------------------------------------- */
/*                     static preview (onboarding wizard)                      */
/* -------------------------------------------------------------------------- */

export interface PreviewShiftHours {
  morning: { start: number; end: number };
  afternoon: { start: number; end: number };
  night: { start: number; end: number };
}

export type PreviewConfig =
  | { type: "regular_day"; start_hour: number; end_hour: number; weekdays_only: boolean }
  | { type: "rotating"; pattern: "2-2-2-2" | "3-3-3-3"; hours: PreviewShiftHours }
  | {
      type: "extended_rotating";
      hours: { day: { start: number; end: number }; night: { start: number; end: number } };
    };

export interface PreviewTeam {
  name: string;
  current_shift?: string | undefined;
  shift_config?: PreviewConfig;
}

/** Day-0 cycle letters for a config (Team A's phase). */
function baseCycle(config: PreviewConfig): string[] {
  if (config.type === "rotating") {
    const block = rotatingBlock(config.pattern);
    return [
      ...Array<string>(block).fill("M"),
      ...Array<string>(block).fill("A"),
      ...Array<string>(block).fill("N"),
      ...Array<string>(block).fill("-"),
    ];
  }
  if (config.type === "extended_rotating") return ["D", "N", "-"];
  return config.weekdays_only
    ? ["D", "D", "D", "D", "D", "-", "-"]
    : ["D", "D", "D", "D", "D", "D", "D"];
}

/** Where a team sits in its cycle on day 0, derived from the wizard's current_shift. */
function cycleOffset(config: PreviewConfig, currentShift?: string): number {
  if (config.type === "rotating") {
    const block = rotatingBlock(config.pattern);
    if (currentShift === "afternoon") return block;
    if (currentShift === "night") return block * 2;
    if (currentShift === "off") return block * 3;
    return 0;
  }
  if (config.type === "extended_rotating") {
    if (currentShift === "night") return 1;
    if (currentShift === "off") return 2;
    return 0;
  }
  return 0;
}

function configTimes(config: PreviewConfig): Map<string, string> {
  const times = new Map<string, string>();
  if (config.type === "rotating") {
    times.set("M", `${formatHour(config.hours.morning.start)}–${formatHour(config.hours.morning.end)}`);
    times.set("A", `${formatHour(config.hours.afternoon.start)}–${formatHour(config.hours.afternoon.end)}`);
    times.set("N", `${formatHour(config.hours.night.start)}–${formatHour(config.hours.night.end)}`);
  } else if (config.type === "extended_rotating") {
    times.set("D", `${formatHour(config.hours.day.start)}–${formatHour(config.hours.day.end)}`);
    times.set("N", `${formatHour(config.hours.night.start)}–${formatHour(config.hours.night.end)}`);
  } else {
    times.set("D", `${formatHour(config.start_hour)}–${formatHour(config.end_hour)}`);
  }
  return times;
}

/** Roster used when the caller has no teams — matches the wizard's generated set. */
function defaultPreviewTeams(config: PreviewConfig): PreviewTeam[] {
  if (config.type === "rotating") {
    return [
      { name: "Team A", current_shift: "morning" },
      { name: "Team B", current_shift: "afternoon" },
      { name: "Team C", current_shift: "night" },
      { name: "Team D", current_shift: "off" },
    ];
  }
  if (config.type === "extended_rotating") {
    return [
      { name: "Team A", current_shift: "day" },
      { name: "Team B", current_shift: "night" },
      { name: "Team C", current_shift: "off" },
    ];
  }
  return [{ name: "Team A" }];
}

const PREVIEW_DAYS = 14;

/**
 * The onboarding cycle visual: one row per team across a 14-day grid, each
 * phase-shifted to its `current_shift` (static mode — computed client-side
 * from the shift config; falls back to a default roster when no teams given).
 */
export function CyclePreview({
  config,
  teams,
}: {
  config: PreviewConfig;
  teams?: PreviewTeam[];
}) {
  const sourceTeams = teams && teams.length > 0 ? teams : defaultPreviewTeams(config);
  const rows = sourceTeams.map((team) => {
    const teamConfig = team.shift_config ?? config;
    const cycle = baseCycle(teamConfig);
    const offset = cycleOffset(teamConfig, team.current_shift);
    return {
      label: team.name,
      times: configTimes(teamConfig),
      letters: Array.from(
        { length: PREVIEW_DAYS },
        (_, i) => cycle[(offset + i) % cycle.length]!,
      ),
    };
  });

  const caption =
    config.type === "rotating"
      ? `${config.pattern} schedule — 14-day preview`
      : config.type === "extended_rotating"
        ? "Day → Night → Off schedule — 14-day preview"
        : "Regular day schedule — 14-day preview";

  const legendLetters = [...new Set(rows.flatMap((r) => r.letters).filter((l) => l !== "-"))];
  const hasOff = rows.some((r) => r.letters.includes("-"));

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{caption}</p>
      <div className="overflow-x-auto">
        <div className="min-w-[440px]">
          <div className="grid grid-cols-[52px_repeat(14,minmax(0,1fr))] gap-1 text-center">
            <div />
            {DAY_LABELS.flatMap((d) => [d, d]).map((d, i) => (
              <div key={`h-${i}`} className="text-[10px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {rows.map((row, ri) => (
              <Fragment key={ri}>
                <div
                  className="flex min-w-0 items-center truncate pr-1 text-left text-[10px] font-medium"
                  title={row.label}
                >
                  {row.label}
                </div>
                {row.letters.map((s, i) => (
                  <div
                    key={i}
                    title={
                      s === "-"
                        ? "Off"
                        : `${LETTER_LABELS[s]}${row.times.get(s) ? `: ${row.times.get(s)}` : ""}`
                    }
                    className={cn(
                      "rounded border px-0 py-1 text-center text-[10px] font-semibold",
                      LETTER_STYLES[s],
                    )}
                  >
                    {s}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {legendLetters.map((l) => {
          const time = rows.find((r) => r.times.has(l))?.times.get(l);
          return (
            <span key={l}>
              <span className={cn("inline-block h-2 w-2 rounded-full", LETTER_DOTS[l] ?? "")} />{" "}
              {LETTER_LABELS[l]}
              {time ? `: ${time}` : ""}
            </span>
          );
        })}
        {hasOff ? (
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/60" /> Off: Rest
            day
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                     data-driven strip (Schedule page)                       */
/* -------------------------------------------------------------------------- */

export interface StripCell {
  shiftType: string | null;
  start: string | null;
  end: string | null;
}

export interface StripRow {
  key: string;
  label: string;
  cells: StripCell[];
}

/**
 * The onboarding cycle visual driven by live pattern data — one row per crew
 * (team or synthetic track) across the anchored week, phase-accurate.
 */
export function ShiftCycleStrip({
  caption,
  colDates,
  today,
  rows,
}: {
  caption: string;
  colDates: string[];
  today?: string;
  rows: StripRow[];
}) {
  const gridClass = "grid grid-cols-[110px_repeat(7,minmax(0,1fr))] gap-1";

  const seen = new Set(
    rows.flatMap((r) => r.cells.map((c) => shiftTypeLetter(c.shiftType))),
  );

  const legend: Array<{ letter: string; time: string }> = [];
  for (const l of ["M", "A", "N", "D"] as const) {
    if (!seen.has(l)) continue;
    let time: string | undefined;
    outer: for (const row of rows) {
      for (const cell of row.cells) {
        if (shiftTypeLetter(cell.shiftType) === l && cell.start && cell.end) {
          time = `${cell.start}–${cell.end}`;
          break outer;
        }
      }
    }
    legend.push({ letter: l, time: time ?? "" });
  }
  if (seen.has("-")) legend.push({ letter: "-", time: "Rest day" });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{caption}</p>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className={cn(gridClass, "pb-1")}>
            <div />
            {colDates.map((col) => (
              <div
                key={col}
                className={cn(
                  "text-center text-[10px] font-medium",
                  col === today ? "text-primary" : "text-muted-foreground",
                )}
              >
                {format(parseISO(col), "EEE")}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.key} className={cn(gridClass, "py-0.5")}>
              <div
                className="flex items-center truncate pr-1 text-[11px] font-medium"
                title={row.label}
              >
                {row.label}
              </div>
              {row.cells.map((cell, i) => {
                const letter = shiftTypeLetter(cell.shiftType);
                const title =
                  letter === "-"
                    ? "Off"
                    : `${shiftLabel(cell.shiftType) ?? ""}${
                        cell.start && cell.end ? ` · ${cell.start}–${cell.end}` : ""
                      }`;
                return (
                  <div
                    key={i}
                    title={title}
                    className={cn(
                      "rounded border px-1 py-1 text-center text-[10px] font-semibold",
                      LETTER_STYLES[letter] ?? LETTER_STYLES["-"],
                    )}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {legend.map((entry) => (
          <span key={entry.letter}>
            <span
              className={cn("inline-block h-2 w-2 rounded-full", LETTER_DOTS[entry.letter] ?? "")}
            />{" "}
            {LETTER_LABELS[entry.letter]}
            {entry.time ? `: ${entry.time}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
