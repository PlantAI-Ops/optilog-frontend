import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { achievement, assetRollup, lineName, teamSummary, teams } from "@/lib/ops-model";

export const Route = createFileRoute("/console/teams")({
  head: () => ({
    meta: [
      { title: "Team Performance | Shift-Log Operations Console" },
      {
        name: "description",
        content:
          "Compare teams across shifts: achievement, downtime, event volume and open issues, plus the worst-performing assets.",
      },
      { property: "og:title", content: "Team Performance | Shift-Log" },
      { property: "og:description", content: "Per-team and per-shift operational performance." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  return (
    <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
      <div className="grid gap-6 xl:grid-cols-3">
        {teams.map((team) => {
          const t = teamSummary(team.id);
          return (
            <section key={team.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-base font-semibold">{team.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Supervisor {team.supervisor} · {team.headcount} operators
                  </p>
                </div>
                <span className="text-2xl font-bold tabular-nums text-success">
                  {t.achievement}%
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Events</p>
                  <p className="text-sm font-semibold tabular-nums">{t.events}</p>
                </div>
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Downtime</p>
                  <p className="text-sm font-semibold tabular-nums">{t.downtime}m</p>
                </div>
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Open</p>
                  <p className="text-sm font-semibold tabular-nums">{t.open}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {t.shifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {s.date} · {s.name} · {lineName(s.line_id)}
                    </span>
                    <span className="tabular-nums">{achievement(s)}%</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <h2 className="mt-8 text-sm font-semibold">Asset rollup</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {assetRollup().map((r) => (
          <StatCard
            key={r.asset.id}
            label={r.asset.name}
            value={`${r.downtime} min`}
            hint={`${r.count} events · ${r.topCategories.join(", ") || "no category"}`}
          />
        ))}
      </div>
    </ConsoleShell>
  );
}