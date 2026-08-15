import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell, SourceBadge, StatCard } from "@/components/console/ConsoleShell";
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  achievement,
  events,
  lineName,
  shifts,
  teamName,
} from "@/lib/ops-model";

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
  const [selected, setSelected] = useState(shifts[1]!.id);
  const shift = shifts.find((s) => s.id === selected)!;
  const shiftEvents = events.filter((e) => e.shift_id === shift.id);

  return (
    <ConsoleShell title="Shifts" subtitle="Plant → Team → Shift → Line → Event">
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            All shifts
          </header>
          <ul className="divide-y divide-border/60">
            {shifts.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    s.id === selected ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {teamName(s.team_id)} / {s.name}
                    </span>
                    <span className="text-sm tabular-nums">{achievement(s)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.date} · {lineName(s.line_id)} · {s.downtime_minutes} min down
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Produced" value={shift.produced.toLocaleString()} hint={`Target ${shift.target.toLocaleString()}`} />
            <StatCard label="Achievement" value={`${achievement(shift)}%`} tone="success" />
            <StatCard label="Downtime" value={`${shift.downtime_minutes} min`} tone="warning" />
            <StatCard label="Events" value={shiftEvents.length} hint={`${shift.start}–${shift.end}`} />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3 text-sm font-semibold">
              {teamName(shift.team_id)} / {shift.name} — {lineName(shift.line_id)}
            </header>
            <ul className="divide-y divide-border/60">
              {shiftEvents.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{e.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(e.timestamp).toISOString().slice(11, 16)} · {e.event_type} /{" "}
                        {e.category} · {STATUS_LABEL[e.status]}
                        {e.duration_seconds
                          ? ` · ${Math.round(e.duration_seconds / 60)} min`
                          : ""}
                      </p>
                    </div>
                    <SourceBadge>{SOURCE_LABEL[e.source]}</SourceBadge>
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
        </section>
      </div>
    </ConsoleShell>
  );
}