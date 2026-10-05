import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";

export const Route = createFileRoute("/console/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const user = useShiftLog().user;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !hasMinRole(user.role, "plant_manager")) {
      navigate({ to: "/console", replace: true });
    }
  }, [user, navigate]);

  if (!user || !hasMinRole(user.role, "plant_manager")) {
    return null;
  }

  return <Outlet />;
}
