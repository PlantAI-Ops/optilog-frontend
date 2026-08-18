import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ConsoleShell, SourceBadge, StatCard } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/ops-model";
import { useShiftLog } from "@/lib/shift-log";
import { useShiftEvents, useShifts } from "@/lib/hooks";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Today", value: todayStr() },
  { label: "Yesterday", value: daysAgo(1) },
  { label: "Last 7 days", value: daysAgo(6) },
] as const;

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
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];

  const [date, setDate] = useState(todayStr());
  const [selected, setSelected] = useState<string | null>(null);

  const shifts = useShifts(plantId, date);
  const shiftEvents = useShiftEvents(plantId, selected ?? undefined);

  const activeShift = shifts.data?.find((s) => s.id === selected) ?? shifts.data?.[0];

  if (!plantId) {
    return (
      <ConsoleShell title="Shifts" subtitle="Plant → Team → Shift → Line → Event">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }

  if (shifts.isLoading) {
    return (
      <ConsoleShell title="Shifts" subtitle="Plant → Team → Shift → Line → Event">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (shifts.error) {
    return (
      <ConsoleShell title="Shifts" subtitle="Plant → Team → Shift → Line → Event">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load shifts. {shifts.error.message}
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell title="Shifts" subtitle="Plant → Team → Shift → Line → Event">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setDate(p.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              date === p.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 rounded-lg border border-border bg-secondary px-2 text-xs font-medium outline-none focus:border-ring"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            All shifts
          </header>
          <ul className="divide-y divide-border/60">
            {shifts.data?.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    activeShift?.id === s.id ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {s.team_name} / {s.name}
                    </span>
                    <span className="text-sm tabular-nums">{s.achievement}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.date} · {s.line_name} · {s.downtime_minutes} min down
                  </p>
                </button>
              </li>
            ))}
            {shifts.data?.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No shifts found for this date.</li>
            ) : null}
          </ul>
        </section>

        <section>
          {activeShift ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Produced" value={activeShift.produced.toLocaleString()} hint={`Target ${activeShift.target.toLocaleString()}`} />
                <StatCard label="Achievement" value={`${activeShift.achievement}%`} tone="success" />
                <StatCard label="Downtime" value={`${activeShift.downtime_minutes} min`} tone="warning" />
                <StatCard label="Events" value={shiftEvents.data?.length ?? 0} hint={`${activeShift.start}–${activeShift.end}`} />
              </div>

              <div className="mt-6 rounded-xl border border-border bg-card">
                <header className="border-b border-border px-4 py-3 text-sm font-semibold">
                  {activeShift.team_name} / {activeShift.name} — {activeShift.line_name}
                </header>
                {shiftEvents.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {shiftEvents.data?.map((e) => (
                      <li key={e.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{e.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(e.timestamp).toISOString().slice(11, 16)} · {e.event_type} /{" "}
                              {e.category} · {STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}
                              {e.duration_seconds
                                ? ` · ${Math.round(e.duration_seconds / 60)} min`
                                : ""}
                            </p>
                          </div>
                          <SourceBadge>{SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}</SourceBadge>
                        </div>
                      </li>
                    ))}
                    {shiftEvents.data?.length === 0 ? (
                      <li className="px-4 py-6 text-sm text-muted-foreground">
                        No events recorded on this shift.
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20 text-sm text-muted-foreground">
              Select a shift from the list.
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
