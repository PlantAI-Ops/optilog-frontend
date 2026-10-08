import { useEffect, useState } from "react";

export interface ShiftWindow {
  /** The plant's shift window has closed — recording must stop. */
  over: boolean;
  /** Whole minutes until the window closes (null when unknown or already over). */
  minutesLeft: number | null;
}

function evaluate(windowEnd: string | null | undefined): ShiftWindow {
  if (!windowEnd) return { over: false, minutesLeft: null };
  const end = new Date(windowEnd).getTime();
  if (Number.isNaN(end)) return { over: false, minutesLeft: null };
  const diff = end - Date.now();
  if (diff <= 0) return { over: true, minutesLeft: 0 };
  return { over: false, minutesLeft: Math.ceil(diff / 60_000) };
}

/**
 * Ticks once a second against the plant's shift-window end (from
 * `GET /plants/{id}/shifts/now`) so the recorder can warn before the window
 * closes and hard-stop when it does. A missing/invalid end fails open (never
 * blocks an operator because a timestamp failed to parse).
 */
export function useShiftWindow(windowEnd: string | null | undefined): ShiftWindow {
  const [value, setValue] = useState<ShiftWindow>(() => evaluate(windowEnd));

  useEffect(() => {
    setValue(evaluate(windowEnd));
    if (!windowEnd) return;
    const id = window.setInterval(() => setValue(evaluate(windowEnd)), 1000);
    return () => window.clearInterval(id);
  }, [windowEnd]);

  return value;
}
