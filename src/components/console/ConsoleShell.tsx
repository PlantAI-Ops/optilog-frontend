import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Database,
  Gauge,
  LogOut,
  Plug,
  Search,
  Shield,
  Smartphone,
  User,
  Users,
  Wrench,
  LayoutDashboard,
  LayoutGrid,
} from "lucide-react";
import { usePlant, useShiftsNow } from "@/lib/hooks";
import { formatWindow, shiftLabel } from "@/lib/shift-now";
import { canLogShift, logoutHard, hasMinRole, useShiftLog } from "@/lib/shift-log";

const NAV = [
  { to: "/console", label: "Dashboard", icon: Gauge, exact: true },
  { to: "/console/shifts", label: "Shifts", icon: CalendarClock, exact: false },
  { to: "/console/calendar", label: "Calendar", icon: CalendarDays, exact: false },
  { to: "/console/schedule", label: "Schedule", icon: CalendarRange, exact: false },
  { to: "/console/maintenance", label: "Maintenance", icon: Wrench, exact: false },
  { to: "/console/teams", label: "Teams", icon: Users, exact: false },
  { to: "/console/layout", label: "Layout", icon: LayoutGrid, exact: false },
  { to: "/console/events", label: "Events", icon: Activity, exact: false },
  { to: "/console/rca", label: "RCA", icon: Search, exact: false },
  { to: "/console/integrations", label: "Connect", icon: Plug, exact: false },
  { to: "/console/data", label: "Data model", icon: Database, exact: false },
] as const;

const ADMIN_NAV = { to: "/console/admin", label: "Admin", icon: Shield, exact: true } as const;

const SYSTEM_ADMIN_NAV = {
  to: "/console/admin/system",
  label: "System Admin",
  icon: LayoutDashboard,
  exact: false,
} as const;

export function ConsoleShell({
  children,
  title,
  subtitle,
  plantName,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  plantName?: string;
}) {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  // Plant tabs are dead weight for accounts with no plant (system_admin).
  // They are hidden by default; system_admin can re-reveal them via a
  // persisted toggle - revealed tabs still land on the ConsoleGate card.
  const hasPlant = !!user?.plant_ids?.length;
  const isAdmin = !!user && hasMinRole(user.role, "system_admin");
  const [showPlantTabs, setShowPlantTabs] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("optilog.console.showPlantTabs") === "1";
    } catch {
      return false;
    }
  });
  const plantTabsVisible = hasPlant || (isAdmin && showPlantTabs);
  const togglePlantTabs = () => {
    const next = !showPlantTabs;
    setShowPlantTabs(next);
    try {
      localStorage.setItem("optilog.console.showPlantTabs", next ? "1" : "0");
    } catch {
      /* private mode: state still toggles for this session */
    }
  };
  const plant = usePlant(plantId);
  const shiftsNow = useShiftsNow(plantId);
  const displayName = plantName ?? plant.data?.name ?? "—";
  const shift = shiftsNow.data?.current_shift ?? null;
  const running = shift ? shiftLabel(shift.shift_type) : null;
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
        <div className="px-2 pb-5">
          <p className="text-sm font-black tracking-[0.2em] text-primary">OPTILOG</p>
          <p className="text-xs text-muted-foreground">Operations console</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {plantTabsVisible &&
            NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-secondary/60" }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          {!hasPlant && isAdmin ? (
            <button
              type="button"
              onClick={togglePlantTabs}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60"
            >
              <LayoutDashboard className="size-4" />
              {showPlantTabs ? "Hide plant tabs" : "Show plant tabs"}
            </button>
          ) : null}
          {user && hasMinRole(user.role, "plant_manager") && (
            <Link
              to={ADMIN_NAV.to}
              activeOptions={{ exact: ADMIN_NAV.exact }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-secondary/60" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Shield className="size-4" />
              {ADMIN_NAV.label}
            </Link>
          )}
          {user && hasMinRole(user.role, "system_admin") && (
            <Link
              to={SYSTEM_ADMIN_NAV.to}
              activeOptions={{ exact: SYSTEM_ADMIN_NAV.exact }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-secondary/60" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <LayoutDashboard className="size-4" />
              {SYSTEM_ADMIN_NAV.label}
            </Link>
          )}
        </nav>
        {user && (
          <div
            className="mb-2 mt-3 flex items-start gap-2 border-t border-border px-2 pt-3"
            title={user.email}
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="size-3.5 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              <p className="truncate text-[11px] capitalize text-muted-foreground">
                {user.role.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        )}
        <Link
          to="/"
          className="mt-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
        >
          <Smartphone className="size-4" />
          {canLogShift(user?.role) ? "Mobile capture app" : "Mobile manager home"}
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasPlant &&
                (shift ? (
                  <span
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1"
                    title={`Shift of ${shift.date}${shift.team ? ` · ${shift.team.name}` : ""}`}
                  >
                    <span className="size-2 rounded-full bg-success" />
                    <span className="font-medium text-foreground">{running}</span>
                    <span>{formatWindow(shift.start, shift.end)}</span>
                    {shift.team ? <span>· {shift.team.name}</span> : null}
                  </span>
                ) : !shiftsNow.isLoading && !shiftsNow.isError ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                    <span className="size-2 rounded-full bg-muted-foreground/60" />
                    No shift running
                  </span>
                ) : null)}
              {hasPlant && (
                <span className="rounded-full border border-border px-3 py-1">{displayName}</span>
              )}
              <button
                type="button"
                onClick={logoutHard}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 hover:bg-secondary/60"
              >
                <LogOut className="size-3" /> Sign out
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
            {plantTabsVisible &&
              NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  activeProps={{ className: "bg-secondary text-foreground" }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  {item.label}
                </Link>
              ))}
            {!hasPlant && isAdmin ? (
              <button
                type="button"
                onClick={togglePlantTabs}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {showPlantTabs ? "Hide plant tabs" : "Show plant tabs"}
              </button>
            ) : null}
            {user && hasMinRole(user.role, "plant_manager") && (
              <Link
                to={ADMIN_NAV.to}
                activeOptions={{ exact: ADMIN_NAV.exact }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Admin
              </Link>
            )}
            {user && hasMinRole(user.role, "system_admin") && (
              <Link
                to={SYSTEM_ADMIN_NAV.to}
                activeOptions={{ exact: SYSTEM_ADMIN_NAV.exact }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                System Admin
              </Link>
            )}
            <Link
              to="/"
              className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
            >
              <Smartphone className="size-3" /> Mobile
            </Link>
          </nav>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SourceBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}
