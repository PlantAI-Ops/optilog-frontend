import { Link } from "@tanstack/react-router";
import type { Tenant } from "@/lib/shift-log";
import { TrialStatusBadge } from "./TrialStatusBadge";

export function TenantCard({ tenant }: { tenant: Tenant }) {
  const now = typeof window !== "undefined" ? Date.now() : new Date("2024-01-01").getTime();
  const daysLeft =
    tenant.status === "trial" && tenant.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - now) / 86400000))
      : null;

  return (
    <Link
      to="/console/admin/$tenantId"
      params={{ tenantId: tenant.id }}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">{tenant.name}</h3>
          <p className="text-xs text-muted-foreground">{tenant.contact_email}</p>
        </div>
        <TrialStatusBadge status={tenant.status} trialEndsAt={tenant.trial_ends_at} />
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span>
          {tenant.max_plants} plant{tenant.max_plants !== 1 ? "s" : ""}
        </span>
        <span>
          {tenant.max_users} user{tenant.max_users !== 1 ? "s" : ""} max
        </span>
      </div>
      {daysLeft !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
        </p>
      )}
    </Link>
  );
}
