import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, UserPlus } from "lucide-react";
import { ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { TeamMembersDialog } from "@/components/console/TeamMembersDialog";
import { EmptyPlantState } from "@/components/console/EmptyPlantState";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import {
  useAssetRollup,
  useShifts,
  useTeams,
  useTeamsSummary,
  useShiftsNow,
  usePlantTeamsDetail,
  type TeamDetail,
} from "@/lib/hooks";
import { shiftLabel, formatWindow } from "@/lib/shift-now";

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

export const Route = createFileRoute("/console/teams")({
  head: () => ({
    meta: [
      { title: "Team Performance | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "Compare teams across shifts: achievement, downtime, event volume and open issues, plus the worst-performing assets.",
      },
      { property: "og:title", content: "Team Performance | OptiLog" },
      { property: "og:description", content: "Per-team and per-shift operational performance." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];

  const [date, setDate] = useState(todayStr());
  const [membersTeam, setMembersTeam] = useState<TeamDetail | null>(null);

  const teams = useTeams(plantId);
  const teamsSummary = useTeamsSummary(plantId, date);
  const shifts = useShifts(plantId, date);
  const assetRollup = useAssetRollup(plantId, 30);
  const shiftsNow = useShiftsNow(plantId);
  const teamsDetail = usePlantTeamsDetail(plantId);
  const canManage = !!user && hasMinRole(user.role, "supervisor");

  const loading = teams.isLoading || teamsSummary.isLoading || shifts.isLoading || assetRollup.isLoading;
  const error = teams.error || teamsSummary.error || shifts.error || assetRollup.error;

  if (!plantId) {
    return (
      <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
        <p className="text-muted-foreground">No plant is assigned to your account.</p>
      </ConsoleShell>
    );
  }

  if (loading) {
    return (
      <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (error) {
    return (
      <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Failed to load teams data. {error.message}
        </div>
      </ConsoleShell>
    );
  }

  if ((teams.data ?? []).length === 0) {
    return (
      <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
        <EmptyPlantState
          title="No teams yet"
          description="Teams are created as an empty carcass during onboarding (areas, lines, and shift pattern). Configure the plant setup to see team performance here."
        />
      </ConsoleShell>
    );
  }

  const summaryMap = new Map(teamsSummary.data?.map((t) => [t.team_id, t]) ?? []);
  const detailMap = new Map((teamsDetail.data ?? []).map((t) => [t.id, t]));
  const currentShift = shiftsNow.data?.current_shift ?? null;
  const currentTeamId = currentShift?.team?.id ?? null;

  const badgeFor = (teamId: string): { label: string; tone: "on" | "off" } | null => {
    if (!currentShift) return null;
    if (currentTeamId === teamId) {
      return {
        label: `On shift · ${shiftLabel(currentShift.shift_type)} ${formatWindow(
          currentShift.start,
          currentShift.end,
        )}`,
        tone: "on",
      };
    }
    return { label: "Off now", tone: "off" };
  };

  return (
    <ConsoleShell title="Teams" subtitle="Performance by team, broken down per shift">
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

      <div className="grid gap-6 xl:grid-cols-3">
        {teams.data?.map((team) => {
          const t = summaryMap.get(team.id);
          const teamShifts = shifts.data?.filter((s) => s.team_id === team.id) ?? [];
          const badge = badgeFor(team.id);
          const detail = detailMap.get(team.id);
          const memberIds = detail?.member_ids ?? detail?.members?.map((m) => m.id) ?? [];
          const members = detail?.members;
          const badgeClass =
            badge?.tone === "on"
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-secondary text-muted-foreground";
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
                  {t?.achievement ?? 0}%
                </span>
              </div>

              {badge ? (
                <span
                  className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass}`}
                >
                  {badge.label}
                </span>
              ) : null}

              {/* Members preview → opens the shared dialog */}
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Members{memberIds.length > 0 ? ` (${memberIds.length})` : ""}
                  </p>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    onClick={() => setMembersTeam(detail ?? { id: team.id, name: team.name })}
                  >
                    {canManage ? <UserPlus className="size-3.5" /> : null}
                    {canManage ? "Manage members" : "View members"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {members?.slice(0, 4).map((m) => (
                    <li key={m.id} className="truncate text-sm">
                      {m.name}{" "}
                      <span className="text-xs text-muted-foreground">· {m.email}</span>
                    </li>
                  ))}
                  {members && members.length > 4 ? (
                    <li className="text-xs text-muted-foreground">
                      +{members.length - 4} more
                    </li>
                  ) : null}
                  {!members && memberIds.length > 0 ? (
                    <li className="text-sm text-muted-foreground">
                      {memberIds.length} member{memberIds.length === 1 ? "" : "s"}
                    </li>
                  ) : null}
                  {memberIds.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No members yet.</li>
                  ) : null}
                </ul>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Events</p>
                  <p className="text-sm font-semibold tabular-nums">{t?.events ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Downtime</p>
                  <p className="text-sm font-semibold tabular-nums">{t?.downtime ?? 0}m</p>
                </div>
                <div className="rounded-lg border border-border py-2">
                  <p className="text-xs text-muted-foreground">Open</p>
                  <p className="text-sm font-semibold tabular-nums">{t?.open ?? 0}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {teamShifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {s.date} · {s.name} · {s.line_name}
                    </span>
                    <span className="tabular-nums">{s.achievement}%</span>
                  </li>
                ))}
                {teamShifts.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No shifts for this date.</li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      <h2 className="mt-8 text-sm font-semibold">Asset rollup</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {assetRollup.data?.map((r) => (
          <StatCard
            key={r.asset_id}
            label={r.asset_name}
            value={`${r.downtime_minutes} min`}
            hint={`${r.event_count} events · ${r.top_categories.join(", ") || "no category"}`}
          />
        ))}
        {assetRollup.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No asset data available.</p>
        ) : null}
      </div>

      <TeamMembersDialog
        team={membersTeam}
        open={!!membersTeam}
        onOpenChange={(o) => {
          if (!o) setMembersTeam(null);
        }}
      />
    </ConsoleShell>
  );
}
