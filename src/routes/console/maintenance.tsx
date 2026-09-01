import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useShiftLog } from "@/lib/shift-log";
import {
  usePlannedMaintenance,
  useCompletePlannedMaintenance,
  useUpdatePlannedMaintenance,
  type PlannedMaintenanceItem,
} from "@/lib/hooks";

export const Route = createFileRoute("/console/maintenance")({
  head: () => ({
    meta: [
      { title: "Planned Maintenance | Shift-Log Operations Console" },
      {
        name: "description",
        content: "View and manage all planned maintenance items scheduled across shifts.",
      },
      { property: "og:title", content: "Planned Maintenance | Shift-Log" },
      { property: "og:description", content: "Scheduled maintenance items across all shifts." },
    ],
  }),
  component: MaintenancePage,
});

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

function MaintenancePage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const monthStr = format(month, "yyyy-MM");

  const planned = usePlannedMaintenance(plantId, monthStr);
  const complete = useCompletePlannedMaintenance();
  const update = useUpdatePlannedMaintenance();

  const items = planned.data ?? [];

  // Group by planned_date
  const grouped = items.reduce<Record<string, PlannedMaintenanceItem[]>>((acc, item) => {
    const key = item.planned_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <ConsoleShell title="Planned Maintenance" subtitle="Scheduled maintenance across all shifts">
      {/* Month picker */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="rounded-lg border border-border bg-secondary p-1.5 text-muted-foreground hover:bg-secondary/80"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[120px] text-center text-sm font-semibold">
          {format(month, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-lg border border-border bg-secondary p-1.5 text-muted-foreground hover:bg-secondary/80"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Content */}
      {planned.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : planned.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load planned maintenance. {planned.error.message}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center">
          <Wrench className="mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No planned maintenance this month</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Push unresolved issues from the timeline or end-shift handover.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="size-4" />
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <div className="space-y-3">
                {(grouped[date] ?? []).map((item) => (
                  <MaintenanceCard
                    key={item.event_id}
                    item={item}
                    plantId={plantId ?? ""}
                    onComplete={() => complete.mutateAsync({ plantId: plantId ?? "", eventId: item.event_id })}
                    onReschedule={(newDate) =>
                      update.mutateAsync({
                        plantId: plantId ?? "",
                        eventId: item.event_id,
                        patch: { planned_date: newDate },
                      })
                    }
                    onCancel={() =>
                      update.mutateAsync({
                        plantId: plantId ?? "",
                        eventId: item.event_id,
                        patch: { status: "confirmed" },
                      })
                    }
                    isCompletePending={complete.isPending}
                    isUpdatePending={update.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
}

function MaintenanceCard({
  item,
  plantId,
  onComplete,
  onReschedule,
  onCancel,
  isCompletePending,
  isUpdatePending,
}: {
  item: PlannedMaintenanceItem;
  plantId: string;
  onComplete: () => Promise<unknown>;
  onReschedule: (newDate: string) => Promise<unknown>;
  onCancel: () => Promise<unknown>;
  isCompletePending: boolean;
  isUpdatePending: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(item.planned_date);
  const severityDot = SEVERITY_COLORS[item.severity] ?? "bg-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${severityDot}`} />
              <span className="text-sm font-semibold capitalize">{item.event_type}</span>
              <span className="text-xs text-muted-foreground">· {item.severity}</span>
            </div>
            <p className="mt-1 text-sm leading-snug break-words">{item.observation}</p>
            {item.reported_cause && (
              <p className="mt-1 text-xs text-muted-foreground break-words">
                Cause: {item.reported_cause}
              </p>
            )}
            {item.suspected_cause && (
              <p className="mt-0.5 text-xs text-muted-foreground break-words">
                Suspected: {item.suspected_cause}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{item.asset_name}</span>
          <span>{item.line_name}</span>
          <span>{item.shift_name} · {item.team_name}</span>
          <span>Logged by {item.logged_by}</span>
        </div>

        {item.maintenance_notes && (
          <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground break-words">
            {item.maintenance_notes}
          </div>
        )}

        {item.assigned_team && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Assigned: <span className="text-foreground">{item.assigned_team}</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-border">
        <button
          type="button"
          onClick={() => setShowActions(!showActions)}
          className="flex-1 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/50"
        >
          {showActions ? "Hide actions" : "Actions"}
        </button>
      </div>

      {showActions && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onComplete()}
              disabled={isCompletePending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-success/10 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-60"
            >
              <CheckCircle2 className="size-4" />
              {isCompletePending ? "Completing..." : "Complete"}
            </button>
            <button
              type="button"
              onClick={() => onCancel()}
              disabled={isUpdatePending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-xs font-medium hover:bg-secondary/80 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              {isUpdatePending ? "Cancelling..." : "Cancel"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="h-10 flex-1 rounded-lg border border-border bg-secondary px-3 text-xs outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={() => onReschedule(rescheduleDate)}
              disabled={isUpdatePending || rescheduleDate === item.planned_date}
              className="flex h-10 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-xs font-medium hover:bg-secondary/80 disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" />
              Reschedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
