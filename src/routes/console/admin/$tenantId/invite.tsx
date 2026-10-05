import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { UserInviteForm, type InviteResult } from "@/components/admin/UserInviteForm";
import { CsvInviteUpload } from "@/components/admin/CsvInviteUpload";
import { useTenantPlants, useInviteUser } from "@/lib/admin-hooks";
import { useState } from "react";
import { Loader2, Check } from "lucide-react";

export const Route = createFileRoute("/console/admin/$tenantId/invite")({
  head: () => ({
    meta: [{ title: "Invite Users | OptiLog Admin" }],
  }),
  component: InvitePage,
});

type InviteMode = "manual" | "csv";

function InvitePage() {
  const { tenantId } = Route.useParams();
  const plants = useTenantPlants(tenantId);
  const inviteUser = useInviteUser(tenantId);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<InviteMode>("manual");

  const handleInvite = async (data: {
    email: string;
    role: import("@/lib/shift-log").Role;
    plant_ids: string[];
  }): Promise<InviteResult> => {
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
  };

  return (
    <ConsoleShell title="Invite Users" subtitle="Send invitations to join this tenant">
      {plants.isLoading ? (
        <div className="flex items-center justify-center py-20" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading plants</span>
        </div>
      ) : sent ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center py-20 text-center"
        >
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
          {/* Mode toggle */}
          <div className="mb-6 flex gap-1 rounded-lg border border-border bg-secondary/50 p-1">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "manual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setMode("csv")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "csv"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              CSV Upload
            </button>
          </div>

          {mode === "manual" ? (
            <UserInviteForm
              plants={plants.data ?? []}
              onInvite={handleInvite}
              onComplete={(results) => {
                if (results.some((r) => r.ok)) setSent(true);
              }}
            />
          ) : (
            <CsvInviteUpload
              plants={plants.data ?? []}
              onInvite={handleInvite}
              onComplete={(results) => {
                if (results.some((r) => r.ok)) setSent(true);
              }}
            />
          )}
        </div>
      )}
    </ConsoleShell>
  );
}
