import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CloudOff, CloudUpload, LogOut, Monitor, Wifi, WifiOff, ChevronLeft } from "lucide-react";
import { logout, pendingCount, setOnline, useShiftLog } from "@/lib/shift-log";

export function AppShell({ children, title, onBack }: { children: ReactNode; title?: string; onBack?: () => void }) {
  const state = useShiftLog();
  const pending = pendingCount(state);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex size-9 items-center justify-center -ml-1 rounded-xl text-primary"
            >
              <ChevronLeft className="size-6" />
            </button>
          ) : null}
          <Link to="/" className="flex flex-col leading-tight">
            <span className="text-sm font-black tracking-[0.2em] text-primary">SHIFT-LOG</span>
            {title ? (
              <span className="text-xs font-medium text-muted-foreground truncate">{title}</span>
            ) : null}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/console"
            aria-label="Open operations console"
            className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground"
          >
            <Monitor className="size-5" />
          </Link>
          {pending > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-warning/20 px-3 py-1.5 text-xs font-bold text-warning">
              {state.online ? <CloudUpload className="size-4" /> : <CloudOff className="size-4" />}
              {pending} pending
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setOnline(!state.online)}
            aria-label={state.online ? "Simulate going offline" : "Simulate going online"}
            className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground"
          >
            {state.online ? (
              <Wifi className="size-5 text-success" />
            ) : (
              <WifiOff className="size-5 text-destructive" />
            )}
          </button>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4 pb-8 pt-4">{children}</main>
    </div>
  );
}
