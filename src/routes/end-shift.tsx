import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Mic } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { endShift, hasMinRole, unresolvedCount, useShiftLog } from "@/lib/shift-log";

export const Route = createFileRoute("/end-shift")({
  head: () => ({
    meta: [
      { title: "End shift & handover — Shift-Log" },
      {
        name: "description",
        content:
          "Close out the shift with a summary of events and a handover note for the next crew.",
      },
      { property: "og:title", content: "End shift & handover — Shift-Log" },
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
  const unresolved = unresolvedCount(state);
  const resolved = state.events.filter((e) => e.status === "resolved").length;
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");

  const handleEnd = async () => {
    try {
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
            className="mt-2 w-full resize-none rounded-2xl border border-input bg-secondary p-4 text-base outline-none focus:border-ring"
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

        {state.error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-base font-medium text-destructive">
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
