import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { useTeams } from "@/hooks/use-teams";
import { usePlants } from "@/hooks/use-assets";

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
  const { data: plants } = usePlants();
  const plantId = plants?.[0]?.id ?? "";

  const { data: teams, isLoading } = useTeams(plantId);

  return (
    <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Loading teams...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {teams?.map((team) => (
            <section key={team.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-base font-semibold">{team.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Supervisor {team.supervisor_id ?? "—"} · {team.member_ids.length} members
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Members</p>
                  <p className="text-sm font-semibold tabular-nums">{team.member_ids.length}</p>
                </div>
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-semibold capitalize">{team.active ? "Active" : "Inactive"}</p>
                </div>
              </div>
            </section>
          ))}
          {(!teams || teams.length === 0) ? (
            <div className="col-span-full rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No teams configured. Create a team to get started.
            </div>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}