import { createFileRoute, Link } from "@tanstack/react-router";
import { ConsoleShell, StatCard, SourceBadge } from "@/components/console/ConsoleShell";
import { useShifts } from "@/hooks/use-shifts";
import { useEvents } from "@/hooks/use-events";
import { useTeams } from "@/hooks/use-teams";
import { usePlants } from "@/hooks/use-assets";

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
  // Fetch data from API
  const { data: plants } = usePlants();
  const plantId = plants?.[0]?.id ?? "";

  const { data: shiftsData } = useShifts({ plant_id: plantId });
  const { data: eventsData } = useEvents({ plant_id: plantId });
  const { data: teams } = useTeams(plantId);

  const shifts = shiftsData?.items ?? [];
  const events = eventsData?.items ?? [];

  // Calculate summary from real data
  const totalProduced = shifts.reduce((sum, s) => sum + (s.summary?.event_count ?? 0), 0);
  const totalDowntime = Math.round(
    shifts.reduce((sum, s) => sum + (s.summary?.downtime_seconds ?? 0), 0) / 60,
  );
  const activeIssues = events.filter(
    (e) => e.status === "draft" || e.status === "confirmed",
  ).length;
  const unresolved = events.filter((e) => e.status === "draft").length;

  return (
    <ConsoleShell title="Plant dashboard" subtitle="Today — all teams, all shifts">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active shifts"
          value={shifts.length}
          hint={`${shifts.filter((s) => s.status === "active").length} in progress`}
          tone="success"
        />
        <StatCard label="Downtime" value={`${totalDowntime} min`} tone="warning" />
        <StatCard label="Active issues" value={activeIssues} hint={`${unresolved} unresolved`} tone="danger" />
        <StatCard label="Total events" value={events.length} hint="All sources" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Shifts</h2>
            <Link to="/console/shifts" className="text-xs font-medium text-primary">
              All shifts
            </Link>
          </header>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Team</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Events</th>
                <th className="px-4 py-2 text-right font-medium">Downtime</th>
                <th className="px-4 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{shift.team_id}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{shift.shift_type}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{shift.summary?.event_count ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-warning">
                    {Math.round((shift.summary?.downtime_seconds ?? 0) / 60)} min
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SourceBadge>{shift.status}</SourceBadge>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No shifts found. Configure a plant to get started.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Teams</h2>
          <ul className="mt-3 space-y-3">
            {teams?.map((team) => (
              <li key={team.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{team.name}</p>
                  <span className="text-xs text-muted-foreground">{team.member_ids.length} members</span>
                </div>
              </li>
            ))}
            {(!teams || teams.length === 0) ? (
              <li className="text-sm text-muted-foreground">No teams configured.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Latest events</h2>
            <Link to="/console/events" className="text-xs font-medium text-primary">
              Event stream
            </Link>
          </header>
          <ul className="divide-y divide-border/60">
            {events.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{e.observation || e.event_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.event_type} · {e.severity ?? "no severity"}
                  </p>
                </div>
                <SourceBadge>{e.source?.system ?? e.source?.type ?? "unknown"}</SourceBadge>
              </li>
            ))}
            {events.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No events yet. Events will appear here as they are recorded.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Quick stats</h2>
          <ul className="mt-3 space-y-3">
            <li className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Total events</p>
              <p className="text-2xl font-bold tabular-nums">{events.length}</p>
            </li>
            <li className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Active shifts</p>
              <p className="text-2xl font-bold tabular-nums">
                {shifts.filter((s) => s.status === "active").length}
              </p>
            </li>
            <li className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Teams</p>
              <p className="text-2xl font-bold tabular-nums">{teams?.length ?? 0}</p>
            </li>
          </ul>
        </section>
      </div>
    </ConsoleShell>
  );
}