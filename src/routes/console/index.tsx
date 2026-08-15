import { createFileRoute, Link } from "@tanstack/react-router";
import { ConsoleShell, StatCard, SourceBadge } from "@/components/console/ConsoleShell";
import {
  SOURCE_LABEL,
  achievement,
  assetRollup,
  incidents,
  lineName,
  plantSummary,
  teamName,
  teamSummary,
  teams,
  todayEvents,
  todayShifts,
} from "@/lib/ops-model";

export const Route = createFileRoute("/console/")({
  head: () => ({
    meta: [
      { title: "Plant Dashboard | Shift-Log Operations Console" },
      {
        name: "description",
        content:
          "Live plant-wide visibility across teams, shifts and lines: achievement, downtime, open issues and pending root cause analyses.",
      },
      { property: "og:title", content: "Plant Dashboard | Shift-Log Operations Console" },
      {
        property: "og:description",
        content: "Team, shift and asset performance from one operational event layer.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const s = plantSummary();
  const rollup = assetRollup().slice(0, 4);

  return (
    <ConsoleShell title="Plant dashboard" subtitle="Today — all teams, all shifts">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Production achievement" value={`${s.achievement}%`} hint={`${s.produced.toLocaleString()} of ${s.target.toLocaleString()} units`} tone="success" />
        <StatCard label="Downtime" value={`${s.downtime} min`} hint="Across 3 active lines" tone="warning" />
        <StatCard label="Active issues" value={s.activeIssues} hint={`${s.unresolved} unresolved`} tone="danger" />
        <StatCard label="RCA pending" value={s.rcaPending} hint={`${s.quality} quality events today`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Team / shift performance</h2>
            <Link to="/console/shifts" className="text-xs font-medium text-primary">
              All shifts
            </Link>
          </header>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Team / shift</th>
                <th className="px-4 py-2 text-left font-medium">Line</th>
                <th className="px-4 py-2 text-right font-medium">Achievement</th>
                <th className="px-4 py-2 text-right font-medium">Downtime</th>
                <th className="px-4 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {todayShifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {teamName(shift.team_id)} / {shift.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lineName(shift.line_id)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{achievement(shift)}%</td>
                  <td className="px-4 py-3 text-right tabular-nums text-warning">
                    {shift.downtime_minutes} min
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SourceBadge>{shift.status}</SourceBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Teams at a glance</h2>
          <ul className="mt-3 space-y-3">
            {teams.map((team) => {
              const t = teamSummary(team.id);
              return (
                <li key={team.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{team.name}</p>
                    <span className="text-sm font-bold tabular-nums">{t.achievement}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {team.supervisor} · {t.events} events · {t.downtime} min down · {t.open} open
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Latest operational events</h2>
            <Link to="/console/events" className="text-xs font-medium text-primary">
              Event stream
            </Link>
          </header>
          <ul className="divide-y divide-border/60">
            {todayEvents.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{e.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lineName(e.line_id)} · {e.event_type} / {e.category} · {teamName(e.team_id)}
                  </p>
                </div>
                <SourceBadge>{SOURCE_LABEL[e.source]}</SourceBadge>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open investigations</h2>
            <Link to="/console/rca" className="text-xs font-medium text-primary">
              RCA
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {incidents.map((i) => (
              <li key={i.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  {i.ref} {i.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lineName(i.line_id)} · {i.duration_minutes} min · owner {i.owner}
                </p>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-semibold">Worst assets (30 days)</h3>
          <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
            {rollup.map((r) => (
              <li key={r.asset.id} className="flex justify-between">
                <span>{r.asset.name}</span>
                <span className="tabular-nums">{r.downtime} min</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ConsoleShell>
  );
}