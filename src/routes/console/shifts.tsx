import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { useShifts } from "@/hooks/use-shifts";
import { useEvents } from "@/hooks/use-events";
import { usePlants } from "@/hooks/use-assets";

export const Route = createFileRoute("/console/shifts")({
  head: () => ({
    meta: [
      { title: "Shift Explorer | Shift-Log Operations Console" },
      {
        name: "description",
        content:
          "Drill from plant to team, shift, line and event: production, target, downtime and open issues for every shift.",
      },
      { property: "og:title", content: "Shift Explorer | Shift-Log" },
      { property: "og:description", content: "Per-shift production, downtime and issue detail." },
    ],
  }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const { data: plants } = usePlants();
  const plantId = plants?.[0]?.id ?? "";

  const { data: shiftsData, isLoading } = useShifts({ plant_id: plantId });
  const shifts = shiftsData?.items ?? [];

  const [selected, setSelected] = useState<string>("");

  const shift = shifts.find((s) => s.id === selected) ?? shifts[0];

  const { data: eventsData } = useEvents({
    ...(plantId ? { plant_id: plantId } : {}),
    ...(shift?.id ? { shift_id: shift.id } : {}),
  });

  const shiftEvents = eventsData?.items ?? [];

  const downtime = Math.round((shift?.summary?.downtime_seconds ?? 0) / 60);
  const eventCount = shift?.summary?.event_count ?? shiftEvents.length;

  return (
    <ConsoleShell title="Shifts" subtitle="Plant → Team → Shift → Line → Event">
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            All shifts
          </header>
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {shifts.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      s.id === (selected || shifts[0]?.id) ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{s.shift_type}</span>
                      <span className="text-xs text-muted-foreground">{s.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.planned_start?.slice(0, 10)} · Team {s.team_id} · {s.summary?.event_count ?? 0} events
                    </p>
                  </button>
                </li>
              ))}
              {shifts.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No shifts found.
                </li>
              ) : null}
            </ul>
          )}
        </section>

        <section>
          {shift ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Type" value={shift.shift_type} hint={shift.status} />
                <StatCard label="Team" value={shift.team_id} />
                <StatCard label="Downtime" value={`${downtime} min`} tone="warning" />
                <StatCard label="Events" value={eventCount} hint={`${shift.planned_start?.slice(11, 16) ?? "—"}–${shift.planned_end?.slice(11, 16) ?? "—"}`} />
              </div>

              <div className="mt-6 rounded-xl border border-border bg-card">
                <header className="border-b border-border px-4 py-3 text-sm font-semibold">
                  Shift events
                </header>
                <ul className="divide-y divide-border/60">
                  {shiftEvents.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{e.observation || e.event_type}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {e.timestamp.slice(11, 16)} · {e.event_type} · {e.severity ?? "—"}
                            {e.duration_seconds
                              ? ` · ${Math.round(e.duration_seconds / 60)} min`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                  {shiftEvents.length === 0 ? (
                    <li className="px-4 py-6 text-sm text-muted-foreground">
                      No events recorded on this shift.
                    </li>
                  ) : null}
                </ul>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              Select a shift to view details.
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}