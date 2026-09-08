import type { TenantStatus } from "@/lib/shift-log";

const STATUS_STYLES: Record<TenantStatus, string> = {
  trial: "bg-blue-100 text-blue-800 border-blue-200",
  active: "bg-green-100 text-green-800 border-green-200",
  suspended: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export function TrialStatusBadge({
  status,
  trialEndsAt,
}: {
  status: TenantStatus;
  trialEndsAt?: string | null;
}) {
  const daysLeft =
    trialEndsAt && status === "trial"
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>
      {daysLeft !== null && (
        <span className="text-xs text-muted-foreground">
          {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
        </span>
      )}
    </span>
  );
}
