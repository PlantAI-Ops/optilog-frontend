import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { TrialStatusBadge } from "@/components/admin/TrialStatusBadge";
import { UserInviteForm, type InviteResult } from "@/components/admin/UserInviteForm";
import { CsvInviteUpload } from "@/components/admin/CsvInviteUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useTenant,
  useTenantPlants,
  useUpdatePlant,
  useDeletePlant,
  useTenantInvitations,
  useInviteUser,
  useRevokeInvitation,
} from "@/lib/admin-hooks";
import type { AdminPlant } from "@/lib/shift-log";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Tokyo",
  "Asia/Shanghai",
];

export const Route = createFileRoute("/console/admin/$tenantId/")({
  head: () => ({
    meta: [{ title: "Tenant Details | OptiLog Admin" }],
  }),
  component: TenantDetailPage,
});

/* -------------------------------------------------------------------------- */
/*                          inline plant edit form                             */
/* -------------------------------------------------------------------------- */

function PlantEditForm({
  plant,
  onSubmit,
  onCancel,
  isPending,
}: {
  plant: AdminPlant;
  onSubmit: (data: { name: string; location: string; timezone: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(plant.name);
  const [location, setLocation] = useState(plant.location);
  const [timezone, setTimezone] = useState(plant.timezone);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`edit-name-${plant.id}`}>Plant name</Label>
        <Input
          id={`edit-name-${plant.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor={`edit-location-${plant.id}`}>Location</Label>
        <Input
          id={`edit-location-${plant.id}`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`edit-tz-${plant.id}`}>Timezone</Label>
        <select
          id={`edit-tz-${plant.id}`}
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (name.trim()) onSubmit({ name: name.trim(), location, timezone });
          }}
          disabled={isPending || !name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <Save className="h-3.5 w-3.5" /> Save
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              plant card                                    */
/* -------------------------------------------------------------------------- */

function PlantCard({
  plant,
  tenantId,
  onDelete,
  isDeleting,
}: {
  plant: AdminPlant;
  tenantId: string;
  onDelete: (plantId: string) => void;
  isDeleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const updatePlant = useUpdatePlant(plant.id, tenantId);

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/40 bg-card p-4">
        <PlantEditForm
          plant={plant}
          onSubmit={(data) => {
            updatePlant.mutate(data, { onSuccess: () => setEditing(false) });
          }}
          onCancel={() => setEditing(false)}
          isPending={updatePlant.isPending}
        />
        {updatePlant.isError && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {updatePlant.error.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{plant.name}</h3>
          <p className="text-xs text-muted-foreground">
            {plant.location || "No location"} · {plant.timezone}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Edit plant"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete plant "${plant.name}"? This cannot be undone.`)) {
                onDelete(plant.id);
              }
            }}
            disabled={isDeleting}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete plant"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             main page                                      */
/* -------------------------------------------------------------------------- */

function TenantDetailPage() {
  const { tenantId } = Route.useParams();
  const navigate = useNavigate();
  const tenant = useTenant(tenantId);
  const plants = useTenantPlants(tenantId);
  const deletePlant = useDeletePlant(tenantId);
  const invitations = useTenantInvitations(tenantId);
  const inviteUser = useInviteUser(tenantId);
  const revokeInvitation = useRevokeInvitation(tenantId);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteMode, setInviteMode] = useState<"manual" | "csv">("manual");

  const loading = tenant.isLoading || plants.isLoading || invitations.isLoading;
  const error = tenant.error || plants.error || invitations.error;

  return (
    <ConsoleShell
      title={tenant.data?.name ?? "Tenant Details"}
      {...(tenant.data ? { subtitle: `@${tenant.data.slug}` } : {})}
    >
      {loading && (
        <div className="flex items-center justify-center py-20" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading tenant details</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive"
        >
          Failed to load tenant. {(tenant.error || plants.error || invitations.error)?.message}
        </div>
      )}

      {tenant.data && (
        <>
          {/* Tenant header */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <TrialStatusBadge
                  status={tenant.data.status}
                  trialEndsAt={tenant.data.trial_ends_at}
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Contact: {tenant.data.contact_email}
                </p>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{tenant.data.max_users} max users</span>
                <span>·</span>
                <span>{tenant.data.max_plants} max plants</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                navigate({ to: "/console/admin/$tenantId/onboard", params: { tenantId } })
              }
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Plant
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" /> Invite Users
            </button>
          </div>

          {/* Invite form */}
          {showInvite && (
            <div className="mb-6 rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Invite Users to {tenant.data.name}</h3>
              <div className="mb-4 flex gap-1 rounded-lg border border-border bg-secondary/50 p-1">
                <button
                  type="button"
                  onClick={() => setInviteMode("manual")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    inviteMode === "manual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setInviteMode("csv")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    inviteMode === "csv"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  CSV Upload
                </button>
              </div>
              {inviteMode === "manual" ? (
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
                />
              ) : (
                <CsvInviteUpload
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
                />
              )}
            </div>
          )}

          {/* Plants */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Plants
              {plants.data && plants.data.length > 0 && (
                <span className="ml-1 text-muted-foreground">({plants.data.length})</span>
              )}
            </h2>
            {plants.data && plants.data.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {plants.data.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    tenantId={tenantId}
                    onDelete={(id) => deletePlant.mutate(id)}
                    isDeleting={deletePlant.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No plants yet. Click "Add Plant" to set one up.
              </p>
            )}
          </div>

          {/* Invitations */}
          <div>
            <h2 className="mb-3 text-sm font-semibold">Pending Invitations</h2>
            {invitations.data && invitations.data.length > 0 ? (
              <div className="space-y-2">
                {invitations.data
                  .filter((inv) => !inv.accepted)
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Revoke invitation for ${inv.email}`}
                        onClick={() => revokeInvitation.mutate(inv.id)}
                        disabled={revokeInvitation.isPending}
                        className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            )}
          </div>
        </>
      )}
    </ConsoleShell>
  );
}
