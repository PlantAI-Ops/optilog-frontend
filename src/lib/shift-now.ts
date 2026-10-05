/** ISO timestamp -> "HH:MM" (local), tolerant of bad input. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "22:00–06:00" from two ISO timestamps. */
export function formatWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = formatClock(start);
  const e = formatClock(end);
  if (!s && !e) return "";
  return `${s}–${e}`;
}

/** "night" -> "Night", "shift_a" -> "Shift a". */
export function shiftLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*                          shift pattern (schedule)                          */
/* -------------------------------------------------------------------------- */

/** Solid dot/bar colors — shared with the calendar page. */
export const SHIFT_COLORS: Record<string, string> = {
  morning: "bg-yellow-400",
  afternoon: "bg-orange-400",
  night: "bg-indigo-400",
  day: "bg-sky-400",
};

interface ShiftCellColors {
  dot: string;
  cell: string;
  text: string;
}

const CELL_OFF: ShiftCellColors = {
  dot: "bg-muted-foreground/50",
  cell: "border-border bg-secondary",
  text: "text-muted-foreground",
};

const CELL_COLORS: Record<string, ShiftCellColors> = {
  morning: {
    dot: "bg-yellow-400",
    cell: "border-yellow-400/40 bg-yellow-400/15",
    text: "text-yellow-700 dark:text-yellow-300",
  },
  afternoon: {
    dot: "bg-orange-400",
    cell: "border-orange-400/40 bg-orange-400/15",
    text: "text-orange-700 dark:text-orange-300",
  },
  night: {
    dot: "bg-indigo-400",
    cell: "border-indigo-400/40 bg-indigo-400/15",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  day: {
    dot: "bg-sky-400",
    cell: "border-sky-400/40 bg-sky-400/15",
    text: "text-sky-700 dark:text-sky-300",
  },
  off: CELL_OFF,
};

/** Colors for a schedule-grid cell keyed by shift_type ("off"/null -> muted). */
export function shiftCellStyle(type: string | null | undefined): ShiftCellColors {
  if (!type || type === "off") return CELL_OFF;
  return CELL_COLORS[type] ?? CELL_OFF;
}

/* -------------------------------------------------------------------------- */
/*                        single-letter shift codes (M/A/N/D/-)                */
/* -------------------------------------------------------------------------- */

export type Letter = "M" | "A" | "N" | "D" | "-";

/** Cell tints — the onboarding palette (blue/amber/indigo + sky for day). */
export const LETTER_STYLES: Record<string, string> = {
  M: "bg-blue-100 text-blue-800 border-blue-200",
  A: "bg-amber-100 text-amber-800 border-amber-200",
  N: "bg-indigo-100 text-indigo-800 border-indigo-200",
  D: "bg-sky-100 text-sky-800 border-sky-200",
  "-": "bg-secondary text-muted-foreground border-border",
};

export const LETTER_DOTS: Record<string, string> = {
  M: "bg-blue-500",
  A: "bg-amber-500",
  N: "bg-indigo-500",
  D: "bg-sky-500",
  "-": "bg-muted-foreground/60",
};

export const LETTER_LABELS: Record<string, string> = {
  M: "Morning",
  A: "Afternoon",
  N: "Night",
  D: "Day",
  "-": "Off",
};

/** shift_type -> cycle letter (off/null -> "-"). */
export function shiftTypeLetter(type: string | null | undefined): Letter {
  if (type === "morning") return "M";
  if (type === "afternoon") return "A";
  if (type === "night") return "N";
  if (type === "day") return "D";
  return "-";
}
