import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";

export const Route = createFileRoute("/console/admin/system")({
  component: SystemAdminLayout,
});

function SystemAdminLayout() {
  const user = useShiftLog().user;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !hasMinRole(user.role, "system_admin")) {
      navigate({ to: "/console", replace: true });
    }
  }, [user, navigate]);

  if (!user || !hasMinRole(user.role, "system_admin")) {
    return null;
  }

  return <Outlet />;
}