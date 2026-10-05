import { Clock } from "lucide-react";
import { useShiftsNow, useTeams } from "@/lib/hooks";
import { useShiftLog } from "@/lib/shift-log";
import { formatWindow, shiftLabel } from "@/lib/shift-now";

/**
 * Plant-wide "what is running right now" banner (dashboard + schedule page).
 * Shows the active shift window plus a teams strip: the rotation-resolved
 * team renders green "On shift", every other active team renders muted "Off".
 * Renders nothing while loading or if GET /plants/{id}/shifts/now is
 * unavailable — the rest of the page must not depend on it.
 */
export function CurrentShiftBanner() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const { data, isLoading, isError } = useShiftsNow(plantId);
  const teams = useTeams(plantId);

  if (isLoading || isError || !data) return null;

  const shift = data.current_shift;
  const onTeam = shift?.team ?? null;
  const teamList = teams.data ?? [];
  const onCount = onTeam ? 1 : 0;
  const offCount = Math.max(teamList.length - onCount, 0);

  // On-shift team first (even if absent from the summary list), then the rest.
  const strip: Array<{ id: string; name: string; on: boolean; hint: string | null }> = [];
  if (onTeam) {
    strip.push({
      id: onTeam.id,
      name: onTeam.name,
      on: true,
      hint: [
        onTeam.supervisor?.name ? `Sup. ${onTeam.supervisor.name}` : null,
        `${onTeam.member_count} member${onTeam.member_count === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  for (const t of teamList) {
    if (t.id === onTeam?.id) continue;
    strip.push({ id: t.id, name: t.name, on: false, hint: null });
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-full ${
              shift ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Clock className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {shift ? "Current shift" : "Plant status"}
            </p>
            <p className="text-lg font-semibold">
              {shift ? (
                <>
                  {shiftLabel(shift.shift_type)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatWindow(shift.start, shift.end)}
                  </span>
                </>
              ) : (
                "No shift running"
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className={shift ? "font-medium text-success" : "text-muted-foreground"}>
            {onCount} team{onCount === 1 ? "" : "s"} on shift
          </span>
          <span className="text-muted-foreground">{offCount} off</span>
          {shift?.team ? (
            <span className="text-muted-foreground">via {shift.source}</span>
          ) : null}
        </div>
      </div>

      {strip.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {strip.map((t) => (
            <span
              key={t.id}
              className={
                t.on
                  ? "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                  : "rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
              }
            >
              {t.name}
              {t.on && t.hint ? (
                <span className="font-normal opacity-80">· {t.hint}</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
