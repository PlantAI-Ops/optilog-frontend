import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, FileText, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import { useApproveShiftReport, useShift } from "@/lib/hooks";
import {
  approveReport,
  canLogShift,
  formatTime,
  hasMinRole,
  unresolvedCount,
  useShiftLog,
} from "@/lib/shift-log";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Shift report — OptiLog" },
      {
        name: "description",
        content: "Review and approve the generated shift report.",
      },
      { property: "og:title", content: "Shift report — OptiLog" },
      {
        property: "og:description",
        content: "Generated shift report with events, causes and handover note.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const state = useShiftLog();
  const navigate = useNavigate();
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");
  const shiftDetail = useShift(state.shiftId ?? undefined);
  const approveShiftReport = useApproveShiftReport();
  const [approveError, setApproveError] = useState<string | null>(null);
  // Local flag right after the tap; the server copy (console, next session)
  // keeps the badge honest afterwards.
  const approved = state.reportApproved || !!shiftDetail.data?.report_approved_at;

  const handleApprove = async () => {
    setApproveError(null);
    if (state.shiftId) {
      try {
        await approveShiftReport.mutateAsync({ shiftId: state.shiftId, approve: true });
      } catch (err: unknown) {
        setApproveError(err instanceof Error ? err.message : "Could not approve the report");
        return;
      }
    }
    approveReport();
  };

  // Part of the voice logging flow — shift_manager+ belongs on the manager home.
  const canLog = canLogShift(state.user?.role);
  useEffect(() => {
    if (state.user && !canLog) navigate({ to: "/", replace: true });
  }, [state.user, canLog, navigate]);
  if (state.user && !canLog) return null;

  return (
    <AppShell title="Shift report">
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <FileText className="size-10 text-primary" />
          <h1 className="mt-3 text-2xl font-black leading-tight">
            {state.shiftName} shift — {state.line}
          </h1>
          <p className="text-base text-muted-foreground">
            {state.startedAt ? formatTime(state.startedAt) : "—"} to{" "}
            {state.endedAt ? formatTime(state.endedAt) : "—"} · {state.events.length} events ·{" "}
            {unresolvedCount(state)} unresolved
          </p>
          {state.handover ? (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-xl bg-secondary p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Handover note
              </p>
              <p className="mt-1 text-base leading-snug break-words">{state.handover}</p>
            </div>
          ) : null}
          <p
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${
              approved ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
            }`}
          >
            <BadgeCheck className="size-4" />
            {approved ? "Approved" : "Awaiting supervisor approval"}
          </p>
          {approveError ? (
            <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {approveError}
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-3">
          {isSupervisor && !approved ? (
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={approveShiftReport.isPending}
              className="flex h-20 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-xl font-black text-primary-foreground disabled:opacity-60"
            >
              {approveShiftReport.isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> Approving…
                </>
              ) : (
                "Approve report"
              )}
            </button>
          ) : null}
          <Link
            to="/timeline"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-card font-bold"
          >
            View full timeline
          </Link>
          <Link
            to="/"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-card font-bold"
          >
            Home
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
