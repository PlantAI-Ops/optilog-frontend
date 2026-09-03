import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ConsoleShell, StatCard, SourceBadge } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL } from "@/lib/ops-model";
import { useShiftLog } from "@/lib/shift-log";
import {
  useAssetRollup,
  useEvents,
  useIncidents,
  usePlantSummary,
  useShifts,
  useTeamsSummary,
} from "@/lib/hooks";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const Route = createFileRoute("/console/")({
  head: () => ({
    meta: [
      { title: "Plant Dashboard | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "Live plant-wide visibility across teams, shifts and lines: achievement, downtime, open issues and pending root cause analyses.",
      },
      { property: "og:title", content: "Plant Dashboard | OptiLog Operations Console" },
      {
        property: "og:description",
        content: "Team, shift and asset performance from one operational event layer.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const today = todayStr();

  const summary = usePlantSummary(plantId, today);
  const shifts = useShifts(plantId, today);
  const teamsSummary = useTeamsSummary(plantId, today);
  const events = useEvents(plantId, today, { limit: 5 });
  const incidents = useIncidents(plantId, "open,in_progress,under_review");
  const assetRollup = useAssetRollup(plantId, 30);

  const loading =
    summary.isLoading ||
    shifts.isLoading ||
    teamsSummary.isLoading ||
    events.isLoading ||
    incidents.isLoading ||
    assetRollup.isLoading;

  const error =
    summary.error ||
    shifts.error ||
    teamsSummary.error ||
    events.error ||
    incidents.error ||
    assetRollup.error;

  if (!plantId) {
    return (
      <ConsoleShell title="Plant dashboard" subtitle="No plant assigned">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }

  if (loading) {
    return (
      <ConsoleShell title="Plant dashboard" subtitle="Today — all teams, all shifts">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (error) {
    return (
      <ConsoleShell title="Plant dashboard" subtitle="Today — all teams, all shifts">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load dashboard data. {error.message}
        </div>
      </ConsoleShell>
    );
  }

  const s = summary.data;
  const rollup = assetRollup.data?.slice(0, 4) ?? [];

  return (
    <ConsoleShell title="Plant dashboard" subtitle="Today — all teams, all shifts">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Production achievement" value={`${s?.achievement ?? 0}%`} hint={`${(s?.produced ?? 0).toLocaleString()} of ${(s?.target ?? 0).toLocaleString()} units`} tone="success" />
        <StatCard label="Downtime" value={`${s?.downtime ?? 0} min`} hint={`Across ${s?.lineCount ?? 0} active lines`} tone="warning" />
        <StatCard label="Active issues" value={s?.activeIssues ?? 0} hint={`${s?.unresolved ?? 0} unresolved`} tone="danger" />
        <StatCard label="RCA pending" value={s?.rcaPending ?? 0} hint={`${s?.quality ?? 0} quality events today`} />
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
              {shifts.data?.map((shift) => (
                <tr key={shift.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {shift.team_name} / {shift.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{shift.line_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{shift.achievement}%</td>
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
            {teamsSummary.data?.map((t) => (
              <li key={t.team_id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.team_name}</p>
                  <span className="text-sm font-bold tabular-nums">{t.achievement}%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.supervisor} · {t.events} events · {t.downtime} min down · {t.open} open
                </p>
              </li>
            ))}
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
            {events.data?.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{e.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.line_name} · {e.event_type} / {e.category} · {e.team_name}
                  </p>
                </div>
                <SourceBadge>{SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source}</SourceBadge>
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
            {incidents.data?.map((i) => (
              <li key={i.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  {i.ref} {i.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i.line_name} · {i.duration_minutes} min · owner {i.owner}
                </p>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-semibold">Worst assets (30 days)</h3>
          <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
            {rollup.map((r) => (
              <li key={r.asset_id} className="flex justify-between">
                <span>{r.asset_name}</span>
                <span className="tabular-nums">{r.downtime_minutes} min</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ConsoleShell>
  );
}
