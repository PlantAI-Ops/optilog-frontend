import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/console/admin/$tenantId")({
  component: TenantLayout,
});

function TenantLayout() {
  return (
    <div>
      <Outlet />
    </div>
  );
}
