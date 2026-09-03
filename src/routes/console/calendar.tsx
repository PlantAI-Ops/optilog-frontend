import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, startOfMonth } from "date-fns";
import { CalendarClock, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useShiftLog } from "@/lib/shift-log";
import { ApiError } from "@/lib/api";
import {
  useShiftsMonth,
  type ShiftDaySummary,
  type ShiftEventSummary,
  type ShiftMonthShift,
} from "@/lib/hooks";

export const Route = createFileRoute("/console/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar | OptiLog Operations Console" },
      {
        name: "description",
        content: "Monthly calendar view of shifts and events across your plant.",
      },
      { property: "og:title", content: "Calendar | OptiLog" },
      { property: "og:description", content: "Monthly calendar view of shifts and events." },
    ],
  }),
  component: CalendarPage,
});

const SHIFT_COLORS: Record<string, string> = {
  morning: "bg-yellow-400",
  afternoon: "bg-orange-400",
  night: "bg-indigo-400",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  investigating: "Investigating",
  resolved: "Resolved",
};

function CalendarPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const monthStr = format(month, "yyyy-MM");
  const monthData = useShiftsMonth(plantId, monthStr);

  const daysWithShifts = new Set(monthData.data?.map((d) => d.date) ?? []);
  const selectedDayData = monthData.data?.find((d) => d.date === selectedDay);
  const selectedShift = selectedDayData?.shifts.find((s) => s.shift_id === selectedShiftId);

  return (
    <ConsoleShell title="Calendar" subtitle="Shifts and events by month">
      <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
        {/* Calendar grid */}
        <div className="rounded-xl border border-border bg-card p-4">
          <Calendar
            mode="single"
            selected={selectedDay ? new Date(selectedDay + "T00:00:00") : undefined}
            month={month}
            onMonthChange={(m) => m && setMonth(m)}
            onDayClick={(day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              setSelectedDay(dateStr);
              setSelectedShiftId(null);
            }}
            className="w-fit"
            components={{
              DayButton: ({ day, modifiers, ...props }) => {
                const dateStr = format(day.date, "yyyy-MM-dd");
                const hasShifts = daysWithShifts.has(dateStr);
                const dayData = monthData.data?.find((d) => d.date === dateStr);
                const totalEvents = dayData?.shifts.reduce((sum, s) => sum + s.event_count, 0) ?? 0;

                return (
                  <button
                    type="button"
                    {...props}
                    className={`relative flex h-10 w-10 flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      modifiers["selected"]
                        ? "bg-primary text-primary-foreground"
                        : modifiers["today"]
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-secondary/60"
                    }`}
                  >
                    <span>{day.date.getDate()}</span>
                    {hasShifts && (
                      <span className="absolute bottom-0.5 flex items-center gap-0.5">
                        {dayData?.shifts.slice(0, 3).map((s) => (
                          <span
                            key={s.shift_id}
                            className={`size-1 rounded-full ${SHIFT_COLORS[s.shift_type] ?? "bg-muted-foreground"}`}
                          />
                        ))}
                        {totalEvents > 0 && (
                          <span className="ml-0.5 rounded-full bg-primary/20 px-1 text-[8px] font-bold text-primary">
                            {totalEvents}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              },
            }}
          />
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-yellow-400" /> Morning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-orange-400" /> Afternoon
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-indigo-400" /> Night
            </span>
          </div>
        </div>

        {/* Day detail panel */}
        <div>
          {!selectedDay ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20 text-sm text-muted-foreground">
              Select a day on the calendar to view shifts.
            </div>
          ) : monthData.isLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : monthData.error && !(monthData.error instanceof ApiError && monthData.error.status === 404) ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
              Failed to load month data. {monthData.error.message}
            </div>
          ) : selectedDayData && selectedDayData.shifts.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(null);
                    setSelectedShiftId(null);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              </div>

              {selectedDayData.shifts.map((shift) => (
                <ShiftCard
                  key={shift.shift_id}
                  shift={shift}
                  isExpanded={selectedShiftId === shift.shift_id}
                  onToggle={() =>
                    setSelectedShiftId(selectedShiftId === shift.shift_id ? null : shift.shift_id)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
              No shifts recorded on this day.
            </div>
          )}
        </div>
      </div>
    </ConsoleShell>
  );
}

function ShiftCard({
  shift,
  isExpanded,
  onToggle,
}: {
  shift: ShiftMonthShift;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const dotColor = SHIFT_COLORS[shift.shift_type] ?? "bg-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
      >
        <span className={`size-3 shrink-0 rounded-full ${dotColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold capitalize">{shift.shift_type} shift</span>
            <span className="text-xs text-muted-foreground">{shift.team_name}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {shift.event_count} event{shift.event_count !== 1 ? "s" : ""}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isExpanded && shift.events.length > 0 && (
        <div className="border-t border-border">
          <ul className="divide-y divide-border/60">
            {shift.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </div>
      )}

      {isExpanded && shift.events.length === 0 && (
        <div className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
          No events recorded on this shift.
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: ShiftEventSummary }) {
  const severityDot = SEVERITY_COLORS[event.severity] ?? "bg-muted-foreground";

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug break-words">{event.observation || event.event_type}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(event.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}{" "}
            · <span className="capitalize">{event.event_type}</span>
            {event.severity ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <span className={`size-1.5 rounded-full ${severityDot}`} />
                  <span className="capitalize">{event.severity}</span>
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {STATUS_LABEL[event.status] ?? event.status}
        </span>
      </div>
    </li>
  );
}
