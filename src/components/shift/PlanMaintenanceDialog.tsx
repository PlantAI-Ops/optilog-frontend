export interface PlanMaintenanceIssue {
  title: string;
  subtitle: string;
  /** Event type (downtime, observation, …). */
  type?: string | undefined;
  /** Line the event happened on. */
  line?: string | undefined;
  /** Operator-reported cause, when captured. */
  reported_cause?: string | undefined;
  /** Who logged the event. */
  logged_by?: string | undefined;
  /** ISO timestamp — rendered client-side (dialog only mounts after a click). */
  timestamp?: string | undefined;
}

function DetailRow({ k, v }: { k: string; v?: string | undefined }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

/**
 * Shared "push this issue to planned maintenance" dialog — used by the mobile
 * shift timeline, the end-of-shift summary and the console Reports queue.
 * The issue is passed as plain text so both `ShiftEvent` (mobile store) and
 * `EventRow` (console queries) can drive it.
 */
export function PlanMaintenanceDialog({
  issue,
  date,
  notes,
  onDateChange,
  onNotesChange,
  onConfirm,
  onCancel,
  isPending,
  error,
}: {
  issue: PlanMaintenanceIssue;
  date: string;
  notes: string;
  onDateChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-black">Plan Maintenance</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule this issue for the next maintenance window.
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-secondary/50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Issue
            </p>
            <p className="mt-1 text-sm font-medium break-words">{issue.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{issue.subtitle}</p>
            {issue.type ||
            issue.line ||
            issue.reported_cause ||
            issue.logged_by ||
            issue.timestamp ? (
              <dl className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs">
                <DetailRow k="Type" v={issue.type} />
                <DetailRow k="Line" v={issue.line} />
                <DetailRow k="Reported cause" v={issue.reported_cause} />
                <DetailRow k="Logged by" v={issue.logged_by} />
                <DetailRow
                  k="Logged at"
                  v={
                    issue.timestamp
                      ? new Date(issue.timestamp).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : undefined
                  }
                />
              </dl>
            ) : null}
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Planned date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-input bg-secondary px-4 text-base outline-none focus:border-ring"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
              placeholder="Any notes for the maintenance team..."
              className="mt-1 w-full resize-none rounded-xl border border-input bg-secondary px-3 py-3 text-base text-foreground outline-none focus:border-ring"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive break-words">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-14 flex-1 rounded-2xl border border-border bg-secondary text-base font-bold text-secondary-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="h-14 flex-[2] rounded-2xl bg-primary text-base font-black text-primary-foreground disabled:opacity-60"
          >
            {isPending ? "Planning..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
