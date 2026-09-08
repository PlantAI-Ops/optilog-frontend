import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { OnboardingWizard } from "@/components/admin/OnboardingWizard";

export const Route = createFileRoute("/console/admin/$tenantId/onboard")({
  head: () => ({
    meta: [{ title: "Onboard Plant | OptiLog Admin" }],
  }),
  component: OnboardPage,
});

function OnboardPage() {
  const { tenantId } = Route.useParams();

  return (
    <ConsoleShell title="Onboard New Plant" subtitle="Step-by-step plant setup wizard">
      <OnboardingWizard tenantId={tenantId} />
    </ConsoleShell>
  );
}
