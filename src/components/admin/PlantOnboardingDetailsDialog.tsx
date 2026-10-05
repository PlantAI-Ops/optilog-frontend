import { ClipboardList, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAreas, useLines, usePlantTeamsDetail } from "@/lib/hooks";
import type { AdminPlant } from "@/lib/shift-log";

function hour(value: unknown): string {
  return `${String(value)}:00`;
}

function shiftSummary(config: Record<string, unknown> | undefined): string {
  if (!config) return "—";
  const type = String(config["type"] ?? "");
  switch (type) {
    case "regular_day":
      return `Regular day ${hour(config["start_hour"])}–${hour(config["end_hour"])}${
        config["weekdays_only"] ? " · weekdays only" : ""
      }`;
    case "rotating":
      return `Rotating ${String(config["pattern"] ?? "")} pattern`;
    case "extended_rotating": {
      const hours = (config["hours"] ?? {}) as Record<string, Record<string, unknown>>;
      const day = hours["day"] ?? {};
      const night = hours["night"] ?? {};
      return `Extended rotating · day ${hour(day["start"])}–${hour(day["end"])}, night ${hour(
        night["start"],
      )}–${hour(night["end"])}`;
    }
    case "extended_day":
      return `Extended day ${hour(config["start_hour"])}–${hour(config["end_hour"])}`;
    case "night":
      return `Night ${hour(config["start_hour"])}–${hour(config["end_hour"])}`;
    default:
      return type ? type.replace(/_/g, " ") : "—";
  }
}

/**
 * Read-only view of a plant's onboarding outcome for the admin consoles.
 * Everything shown here is derived from live records (areas, lines, teams)
 * — the wizard's own metadata (setup mode, preset) is browser-local only
 * and never reaches the server, so it cannot be shown.
 * Mount only while open; the queries run on mount and die on unmount.
 */
export function PlantOnboardingDetailsDialog({
  plant,
  onClose,
}: {
  plant: AdminPlant;
  onClose: () => void;
}) {
  const areas = useAreas(plant.id);
  const lines = useLines(plant.id);
  const teams = usePlantTeamsDetail(plant.id);

  const loading = areas.isLoading || lines.isLoading || teams.isLoading;
  const areaList = areas.data ?? [];
  const lineList = lines.data ?? [];
  const teamList = teams.data ?? [];

  const hasAreas = areaList.length > 0;
  const hasTeams = teamList.length > 0;
  const status: "applied" | "empty" | "partial" =
    hasAreas && hasTeams ? "applied" : !hasAreas && !hasTeams ? "empty" : "partial";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> {plant.name} — Onboarding details
          </DialogTitle>
          <DialogDescription>
            Read-only view of what onboarding created for this plant. Use the onboarding wizard (Add
            Plant) to change it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding details…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  status === "applied" ? "success" : status === "partial" ? "warning" : "default"
                }
              >
                {status === "applied"
                  ? "Setup applied"
                  : status === "partial"
                    ? "Partial setup"
                    : "No structure yet"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {areaList.length} area{areaList.length !== 1 ? "s" : ""} · {lineList.length} line
                {lineList.length !== 1 ? "s" : ""} · {teamList.length} team
                {teamList.length !== 1 ? "s" : ""}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-border bg-secondary/30 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Location
                </dt>
                <dd className="mt-0.5">{plant.location || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Timezone
                </dt>
                <dd className="mt-0.5">{plant.timezone || "—"}</dd>
              </div>
            </dl>

            <section>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Areas
              </h4>
              {areaList.length ? (
                <ul className="flex flex-wrap gap-2">
                  {areaList.map((area) => (
                    <li
                      key={area.id}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                    >
                      {area.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No areas created.</p>
              )}
            </section>

            <section>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lines
              </h4>
              {lineList.length ? (
                <ul className="flex flex-wrap gap-2">
                  {lineList.map((line) => (
                    <li
                      key={line.id}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                    >
                      {line.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No lines created.</p>
              )}
            </section>

            <section>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Teams &amp; shift setup
              </h4>
              {teamList.length ? (
                <ul className="space-y-2">
                  {teamList.map((team) => (
                    <li
                      key={team.id}
                      className="rounded-xl border border-border bg-card p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {team.supervisor_name ?? "No supervisor"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {shiftSummary(team.shift_config)}
                        {team.members?.length
                          ? ` · ${team.members.length} member${team.members.length !== 1 ? "s" : ""}`
                          : team.member_ids?.length
                            ? ` · ${team.member_ids.length} member${team.member_ids.length !== 1 ? "s" : ""}`
                            : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No teams created.</p>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
