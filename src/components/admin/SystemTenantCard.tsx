import { Users, Factory } from "lucide-react";
import type { Tenant } from "@/lib/shift-log";
import { useTenantStats } from "@/lib/admin-hooks";
import { TrialStatusBadge } from "./TrialStatusBadge";

interface SystemTenantCardProps {
  tenant: Tenant;
  onNavigate?: (tenantId: string) => void;
}

export function SystemTenantCard({ tenant, onNavigate }: SystemTenantCardProps) {
  // Per-tenant counts come from GET /admin/tenants/{id}/stats. The previous
  // props (userCount from page 1 of /admin/users, plantCount from a
  // plants_per_tenant key /admin/stats never returns) were always wrong.
  const stats = useTenantStats(tenant.id);
  const now = typeof window !== "undefined" ? Date.now() : new Date("2024-01-01").getTime();
  const daysLeft =
    tenant.status === "trial" && tenant.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - now) / 86400000))
      : null;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(tenant.id);
    }
  };

  const plantLabel = stats.data
    ? `${stats.data.total_plants} plant${stats.data.total_plants !== 1 ? "s" : ""}`
    : "…";
  const userLabel = stats.data
    ? `${stats.data.total_users} user${stats.data.total_users !== 1 ? "s" : ""}`
    : "…";

  return (
    <div
      onClick={handleClick}
      className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold group-hover:text-primary transition-colors">
            {tenant.name}
          </h3>
          <p className="text-xs text-muted-foreground">{tenant.contact_email}</p>
        </div>
        <TrialStatusBadge status={tenant.status} trialEndsAt={tenant.trial_ends_at} />
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Factory className="size-3" />
          {plantLabel}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {userLabel}
        </span>
        <span className="flex items-center gap-1">{tenant.max_plants} max plants</span>
        <span className="flex items-center gap-1">{tenant.max_users} max users</span>
      </div>
      {daysLeft !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Click to view dashboard</span>
        <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View →
        </span>
      </div>
    </div>
  );
}

interface SystemTenantCardSkeletonProps {
  count?: number;
}

export function SystemTenantCardSkeleton({ count = 3 }: SystemTenantCardSkeletonProps = {}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-5 w-3/4 bg-secondary/50 rounded" />
              <div className="mt-1 h-3 w-1/2 bg-secondary/50 rounded" />
            </div>
            <div className="h-6 w-20 bg-secondary/50 rounded-full" />
          </div>
          <div className="mt-3 flex gap-4">
            <div className="h-3 w-20 bg-secondary/50 rounded" />
            <div className="h-3 w-20 bg-secondary/50 rounded" />
            <div className="h-3 w-20 bg-secondary/50 rounded" />
            <div className="h-3 w-20 bg-secondary/50 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
