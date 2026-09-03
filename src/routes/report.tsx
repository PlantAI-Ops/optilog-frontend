import { Link, createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, FileText, Share2 } from "lucide-react";
import { AppShell } from "@/components/shift/AppShell";
import {
  approveReport,
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
        content: "Review, approve and share the generated shift report PDF.",
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
  const isSupervisor = hasMinRole(state.user?.role ?? "operator", "supervisor");

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
              state.reportApproved ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
            }`}
          >
            <BadgeCheck className="size-4" />
            {state.reportApproved ? "Approved" : "Awaiting supervisor approval"}
          </p>
        </div>

        <div className="mt-auto space-y-3">
          {isSupervisor && !state.reportApproved ? (
            <button
              type="button"
              onClick={approveReport}
              className="h-20 w-full rounded-3xl bg-primary text-xl font-black text-primary-foreground"
            >
              Approve report
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary text-lg font-bold"
          >
            <Share2 className="size-5" /> Share PDF
          </button>
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
