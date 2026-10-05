import { Link } from "@tanstack/react-router";
import { Monitor, LogOut } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { useShiftsNow } from "@/lib/hooks";
import { formatWindow, shiftLabel } from "@/lib/shift-now";
import { logout, useShiftLog } from "@/lib/shift-log";

/**
 * Mobile home for shift_manager and above — the voice logging flow
 * (start shift → record → timeline → end shift → report) ends at supervisor.
 * Managers get a read-only "what's running now" card plus console/sign-out
 * actions instead of the recorder.
 */
export function ManagerHome() {
  const state = useShiftLog();
  const user = state.user;
  const plantId = user?.plant_ids?.[0];
  const now = useShiftsNow(plantId);

  if (!user) return null;

  const roleLabel = user.role.replace(/_/g, " ");
  const shift = now.data?.current_shift;

  return (
    <AppShell title="Manager home">
      <div className="flex flex-1 flex-col gap-4 py-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Hi, {user.name}.</h1>
          <p className="mt-1 text-base text-muted-foreground">
            <span className="font-medium capitalize text-foreground">{roleLabel}</span> · voice
            logging is for the floor crew. Manage your plant from the console.
          </p>
        </div>

        {!plantId ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-base text-muted-foreground">
            No plant assigned to your account yet.
          </div>
        ) : now.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-base text-muted-foreground">
            Loading current shift…
          </div>
        ) : shift ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Running now
            </p>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Shift</span>
              <span className="text-right font-bold">
                {shiftLabel(shift.shift_type)} · {formatWindow(shift.start, shift.end)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Team</span>
              <span className="text-right font-bold">
                {shift.team ? `${shift.team.name} · ${shift.team.member_count} on shift` : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 text-base text-muted-foreground">
            No shift running right now.
          </div>
        )}

        <div className="mt-auto space-y-3 pt-2">
          <Link
            to="/console"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground"
          >
            <Monitor className="size-5" /> Open operations console
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary text-base font-bold text-secondary-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </div>
    </AppShell>
  );
}
