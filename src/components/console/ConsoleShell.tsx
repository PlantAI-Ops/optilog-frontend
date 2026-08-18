import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarClock,
  Database,
  Gauge,
  LogOut,
  Plug,
  Search,
  Smartphone,
  Users,
} from "lucide-react";
import { plant } from "@/lib/ops-model";
import { logout } from "@/lib/shift-log";

const NAV = [
  { to: "/console", label: "Dashboard", icon: Gauge, exact: true },
  { to: "/console/shifts", label: "Shifts", icon: CalendarClock, exact: false },
  { to: "/console/teams", label: "Teams", icon: Users, exact: false },
  { to: "/console/events", label: "Events", icon: Activity, exact: false },
  { to: "/console/rca", label: "RCA", icon: Search, exact: false },
  { to: "/console/integrations", label: "Connect", icon: Plug, exact: false },
  { to: "/console/data", label: "Data model", icon: Database, exact: false },
] as const;

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
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
        <div className="px-2 pb-5">
          <p className="text-sm font-black tracking-[0.2em] text-primary">SHIFT-LOG</p>
          <p className="text-xs text-muted-foreground">Operations console</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
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
        </nav>
        <Link
          to="/"
          className="mt-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60"
        >
          <Smartphone className="size-4" /> Mobile capture app
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
              <span className="rounded-full border border-border px-3 py-1">{plantName ?? plant.name}</span>
              <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <span className="size-2 rounded-full bg-success" /> Data layer live
              </span>
              <button
                type="button"
                onClick={() => { logout(); window.location.href = "/"; }}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 hover:bg-secondary/60"
              >
                <LogOut className="size-3" /> Sign out
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map((item) => (
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
  value: string | number;
  hint?: string;
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
