import { useEffect } from "react";
import {
  redirect,
  createFileRoute,
  useNavigate,
  useLocation,
  Outlet,
} from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { getToken } from "@/lib/api";
import { useShiftLog, hasMinRole, logoutHard } from "@/lib/shift-log";
import { EmptyPlantState } from "@/components/console/EmptyPlantState";

export const Route = createFileRoute("/console")({
  // Signed-out SPA navigations bounce before the console tree mounts.
  // Window-gated on purpose: tokens live in localStorage, so on the server
  // getToken() is ALWAYS null — an unguarded check would 307 every fresh
  // load of /console to "/" even for logged-in users (SSR cannot see the
  // token). Fresh loads are covered by ConsoleGate below instead.
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getToken()) {
      throw redirect({ to: "/" });
    }
  },
  component: ConsoleGate,
});

// Root only renders the Outlet after restoreSession has resolved, so `user`
// is authoritative here on the client (and this component never SSRs).
function ConsoleGate() {
  const user = useShiftLog().user;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!user) {
      navigate({ to: "/", replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  // Admin flows (onboarding, user management) stay reachable for accounts
  // that are not assigned to any plant yet.
  const isAdminPath = pathname.startsWith("/console/admin");
  if (!user.plant_ids?.length && !isAdminPath) {
    // This gate intercepts before ConsoleShell mounts, so the card must
    // carry its own launcher: system_admin has no tenant (admin console
    // needs one), plant_manager+ gets the tenant admin console link.
    const launcher =
      hasMinRole(user.role, "system_admin") && !user.tenant_id
        ? { href: "/console/admin/system", label: "Open the System Admin console" }
        : hasMinRole(user.role, "plant_manager") && user.tenant_id
          ? {
              href: `/console/admin/${user.tenant_id}`,
              label: "Set up or manage plants in the admin console",
            }
          : null;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyPlantState
          title="No plant assigned"
          description="Your account is not assigned to a plant yet. Ask an administrator to assign you to a plant to use the operations console."
        />
        {launcher ? (
          <p className="mt-4 text-center">
            <a href={launcher.href} className="text-sm font-medium text-primary hover:underline">
              {launcher.label}
            </a>
          </p>
        ) : null}
        {!hasMinRole(user.role, "system_admin") ? (
          <p className="mt-6 text-center">
            <button
              type="button"
              onClick={logoutHard}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:bg-secondary/60"
            >
              <LogOut className="size-3" /> Sign out
            </button>
          </p>
        ) : null}
      </div>
    );
  }
  return <Outlet />;
}
