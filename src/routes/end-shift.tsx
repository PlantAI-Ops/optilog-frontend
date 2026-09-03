import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Mic, Wrench } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { endShift, hasMinRole, unresolvedCount, useShiftLog, updateEvent } from "@/lib/shift-log";
import { usePlanMaintenance } from "@/lib/hooks";

export const Route = createFileRoute("/end-shift")({
  head: () => ({
    meta: [
      { title: "End shift & handover — OptiLog" },
      {
        name: "description",
        content:
          "Close out the shift with a summary of events and a handover note for the next crew.",
      },
      { property: "og:title", content: "End shift & handover — OptiLog" },
      {
        property: "og:description",
        content: "Shift totals, unresolved issues and the handover note in one screen.",
      },
    ],
  }),
  component: EndShiftPage,
});

function EndShiftPage() {
  const state = useShiftLog();
  const navigate = useNavigate();
  const [note, setNote] = useState(state.handover);
  const [selectedForMaintenance, setSelectedForMaintenance] = useState<Set<string>>(new Set());
  const [maintenanceDate, setMaintenanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const unresolved = unresolvedCount(state);
  const resolved = state.events.filter((e) => e.status === "resolved").length;
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");
  const planMaintenance = usePlanMaintenance();

  const unresolvedEvents = state.events.filter(
    (e) => e.status !== "resolved" && e.status !== "planned_maintenance",
  );

  const toggleEvent = (id: string) => {
    setSelectedForMaintenance((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEnd = async () => {
    try {
      // Push selected events to planned maintenance
      if (isSupervisor && selectedForMaintenance.size > 0) {
        const plantId = state.user?.plant_ids?.[0] ?? "";
        for (const eventId of selectedForMaintenance) {
          const event = state.events.find((e) => e.id === eventId);
          if (!event) continue;
          try {
            await planMaintenance.mutateAsync({
              shiftId: state.shiftId ?? "",
              eventId,
              plantId,
              plannedDate: maintenanceDate,
              notes: "",
              assignedTeam: "",
            });
            updateEvent(eventId, { status: "planned_maintenance" });
          } catch {
            // continue with other events
          }
        }
      }
      await endShift(note);
      navigate({ to: "/report" });
    } catch {
      // error is set in state by endShift()
    }
  };

  return (
    <AppShell title="End of shift">
      <div className="flex flex-1 flex-col gap-5">
        <h1 className="text-2xl font-black">Shift summary</h1>
        <div className="grid grid-cols-3 gap-3">
          <Tile value={state.events.length} label="events" />
          <Tile value={resolved} label="resolved" tone="success" />
          <Tile value={unresolved} label="unresolved" tone="warning" />
        </div>

        <div>
          <p className="text-lg font-bold">Anything the next shift needs to know?</p>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Handover note…"
            className="mt-2 max-h-40 w-full resize-none overflow-y-auto rounded-2xl border border-input bg-secondary p-4 text-base outline-none focus:border-ring"
          />
          <button
            type="button"
            onClick={() =>
              setNote((n) => (n ? n : "Watch the Line 3 motor noise — maintenance is aware."))
            }
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold"
          >
            <Mic className="size-5" /> Dictate note
          </button>
        </div>

        {isSupervisor && unresolvedEvents.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Wrench className="size-5 text-primary" />
              <p className="text-lg font-bold">Push to planned maintenance?</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Select unresolved issues to schedule for the next maintenance window.
            </p>

            <div className="mt-3 space-y-2">
              {unresolvedEvents.map((event) => (
                <label
                  key={event.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    selectedForMaintenance.has(event.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedForMaintenance.has(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-1 size-4 shrink-0 rounded border-border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug break-words">
                      {event.observation || event.event_type}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {event.asset} · {event.severity}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {selectedForMaintenance.size > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <label className="block flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Maintenance date
                  </span>
                  <input
                    type="date"
                    value={maintenanceDate}
                    onChange={(e) => setMaintenanceDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-input bg-secondary px-3 text-sm outline-none focus:border-ring"
                  />
                </label>
                <p className="mt-5 text-xs text-muted-foreground">
                  {selectedForMaintenance.size} issue{selectedForMaintenance.size !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>
        ) : null}

        {state.error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive break-words">
            {state.error}
          </div>
        ) : null}

        {!isSupervisor ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-base font-medium text-warning">
            Ending the shift sends it for supervisor approval.
          </p>
        ) : null}

        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={handleEnd}
            disabled={state.loading}
            className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-xl font-black text-primary-foreground disabled:opacity-60"
          >
            {state.loading ? <Loader2 className="size-5 animate-spin" /> : null}
            End Shift
          </button>
          <Link
            to="/"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-secondary font-bold"
          >
            Not yet — back to shift
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Tile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "success" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning" && value > 0
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-4 text-center">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
