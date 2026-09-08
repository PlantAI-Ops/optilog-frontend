import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { UserInviteForm, type InviteResult } from "@/components/admin/UserInviteForm";
import { useTenantPlants, useInviteUser } from "@/lib/admin-hooks";
import { useState } from "react";
import { Loader2, Check } from "lucide-react";

export const Route = createFileRoute("/console/admin/$tenantId/invite")({
  head: () => ({
    meta: [{ title: "Invite Users | OptiLog Admin" }],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { tenantId } = Route.useParams();
  const plants = useTenantPlants(tenantId);
  const inviteUser = useInviteUser(tenantId);
  const [sent, setSent] = useState(false);

  return (
    <ConsoleShell title="Invite Users" subtitle="Send invitations to join this tenant">
      {plants.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sent ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <p className="mt-4 text-sm font-medium">Invitations sent!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Users will receive emails with links to create their accounts.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            Send more invitations
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-lg">
          <UserInviteForm
            plants={plants.data ?? []}
            onInvite={async (data): Promise<InviteResult> => {
              try {
                await inviteUser.mutateAsync(data);
                return { email: data.email, ok: true };
              } catch (err) {
                return {
                  email: data.email,
                  ok: false,
                  error: err instanceof Error ? err.message : "Unknown error",
                };
              }
            }}
            onComplete={(results) => {
              if (results.some((r) => r.ok)) setSent(true);
            }}
          />
        </div>
      )}
    </ConsoleShell>
  );
}
