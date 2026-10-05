import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  Users,
  Factory,
  Shield,
  AlertCircle,
  TrendingUp,
  ArrowLeft,
  Save,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Mail,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import {
  useTenant,
  useTenantPlants,
  useTenantInvitations,
  useInviteUser,
  useUpdatePlant,
  useDeletePlant,
  useTenantUsers,
  type UserListFilters,
} from "@/lib/admin-hooks";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import { TrialStatusBadge } from "@/components/admin/TrialStatusBadge";
import { PlantOnboardingDetailsDialog } from "@/components/admin/PlantOnboardingDetailsDialog";
import { UserInviteForm, type InviteResult } from "@/components/admin/UserInviteForm";
import { CsvInviteUpload } from "@/components/admin/CsvInviteUpload";
import { PendingInvitations } from "@/components/admin/PendingInvitations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TenantUserTable } from "@/components/admin/TenantUserTable";
import { UserEditModal } from "@/components/admin/UserEditModal";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import { EmptyState } from "@/components/admin/EmptyState";
import type { AdminPlant, SystemUser } from "@/lib/shift-log";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/console/admin/system/tenant/$tenantId/")({
  head: () => ({
    meta: [{ title: "Tenant Dashboard | OptiLog System Admin" }],
  }),
  component: SystemTenantDashboardPage,
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
  const [showOnboarding, setShowOnboarding] = useState(false);
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
            onClick={() => setShowOnboarding(true)}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="View onboarding details (read-only)"
          >
            <ClipboardList className="h-3 w-3" />
          </button>
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
      {showOnboarding ? (
        <PlantOnboardingDetailsDialog plant={plant} onClose={() => setShowOnboarding(false)} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             main page                                      */
/* -------------------------------------------------------------------------- */

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

function SystemTenantDashboardPage() {
  const { tenantId } = Route.useParams();
  const navigate = useNavigate();
  const user = useShiftLog().user;
  const tenant = useTenant(tenantId);
  const plants = useTenantPlants(tenantId);
  const deletePlant = useDeletePlant(tenantId);
  const invitations = useTenantInvitations(tenantId);
  const inviteUser = useInviteUser(tenantId);
  const [userPage, setUserPage] = useState(1);
  const [userFilters, setUserFilters] = useState<UserListFilters>({ active: "all" });
  const tenantUsers = useTenantUsers(tenantId, {
    page: userPage,
    page_size: 20,
    ...userFilters,
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteMode, setInviteMode] = useState<"manual" | "csv">("manual");
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "plants" | "invitations">(
    "overview",
  );
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  useEffect(() => {
    setUserPage(1);
    setUserFilters({ active: "all" });
  }, [tenantId]);

  useEffect(() => {
    if (!user || !hasMinRole(user.role, "system_admin")) {
      navigate({ to: "/console", replace: true });
    }
  }, [user, navigate]);

  if (!user || !hasMinRole(user.role, "system_admin")) {
    return null;
  }

  const loading =
    tenant.isLoading || plants.isLoading || invitations.isLoading || tenantUsers.isLoading;
  const error = tenant.error || plants.error || invitations.error || tenantUsers.error;

  return (
    <ConsoleShell
      title={tenant.data?.name ?? "Tenant Dashboard"}
      {...(tenant.data ? { subtitle: `@${tenant.data.slug}` } : {})}
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/console/admin/system" })}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to System Admin
        </button>
      </div>

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
          Failed to load tenant.{" "}
          {(tenant.error || plants.error || invitations.error || tenantUsers.error)?.message}
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

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value: string) =>
              setActiveTab(value as "overview" | "members" | "plants" | "invitations")
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">
                <Building2 className="mr-2 h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="mr-2 h-4 w-4" /> Members ({tenantUsers.data?.total ?? 0})
              </TabsTrigger>
              <TabsTrigger value="plants">
                <Factory className="mr-2 h-4 w-4" /> Plants ({plants.data?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="invitations">
                <Mail className="mr-2 h-4 w-4" /> Invitations (
                {invitations.data?.filter((i) => !i.accepted).length ?? 0})
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-4 text-sm font-semibold">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setShowCreateUser(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create User
                  </Button>
                  <Button variant="outline" onClick={() => setShowInvite(true)}>
                    <Mail className="mr-2 h-4 w-4" /> Invite Users
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("plants")}>
                    <Factory className="mr-2 h-4 w-4" /> Add Plant
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-4 text-sm font-semibold">Tenant Info</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-1 text-sm">{tenant.data.status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Max Users
                    </p>
                    <p className="mt-1 text-sm">{tenant.data.max_users}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Max Plants
                    </p>
                    <p className="mt-1 text-sm">{tenant.data.max_plants}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Contact
                    </p>
                    <p className="mt-1 text-sm">{tenant.data.contact_email}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* MEMBERS TAB */}
            <TabsContent value="members" className="mt-6 space-y-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Tenant Members ({tenantUsers.data?.total ?? 0})
                </h2>
                <Button onClick={() => setShowCreateUser(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Member
                </Button>
              </div>

              {tenantUsers.data && (
                <TenantUserTable
                  users={tenantUsers.data.users}
                  total={tenantUsers.data.total}
                  page={tenantUsers.data.page}
                  limit={tenantUsers.data.limit}
                  onPageChange={setUserPage}
                  onFiltersChange={(filters) => {
                    setUserFilters(filters);
                    setUserPage(1);
                  }}
                  onEditUser={setEditingUser}
                  onDeleteUser={setEditingUser}
                  plants={plants.data ?? []}
                  loading={tenantUsers.isLoading}
                />
              )}
            </TabsContent>

            {/* PLANTS TAB */}
            <TabsContent value="plants" className="mt-6 space-y-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Plants
                  {plants.data && plants.data.length > 0 && (
                    <span className="ml-1 text-muted-foreground">({plants.data.length})</span>
                  )}
                </h2>
                <Button
                  type="button"
                  onClick={() =>
                    navigate({ to: "/console/admin/$tenantId/onboard", params: { tenantId } })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Plant
                </Button>
              </div>
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
                <EmptyState
                  icon={Factory}
                  title="NO PLANTS"
                  description="Add a plant to start configuring production lines and shifts"
                  action={{
                    label: "Add Plant",
                    onClick: () => setActiveTab("plants"),
                    icon: Plus,
                  }}
                  secondaryAction={{
                    label: "Invite Users",
                    onClick: () => setShowInvite(true),
                    variant: "outline",
                  }}
                  stats={[{ label: "Max Plants", value: String(tenant.data?.max_plants ?? 0) }]}
                  variant="section"
                />
              )}
            </TabsContent>

            {/* INVITATIONS TAB */}
            <TabsContent value="invitations" className="mt-6 space-y-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Pending Invitations</h2>
                <Button variant="outline" onClick={() => setShowInvite(true)}>
                  <Mail className="mr-2 h-4 w-4" /> Invite Users
                </Button>
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

              <PendingInvitations
                tenantId={tenantId}
                invitations={invitations.data}
                empty={
                  <EmptyState
                    icon={Mail}
                    title="NO PENDING INVITATIONS"
                    description="Invite users to join this tenant and start collaborating"
                    action={{
                      label: "Invite Users",
                      onClick: () => setShowInvite(true),
                      icon: Plus,
                    }}
                    stats={[{ label: "Max Users", value: String(tenant.data?.max_users ?? 0) }]}
                    variant="section"
                  />
                }
              />
            </TabsContent>
          </Tabs>

          {/* User Edit Modal */}
          {editingUser && (
            <UserEditModal
              user={editingUser}
              open={true}
              onOpenChange={() => setEditingUser(null)}
              onSuccess={() => {
                setEditingUser(null);
                // Queries auto-invalidate via hooks
              }}
            />
          )}

          {/* Create User Modal */}
          <CreateUserModal
            open={showCreateUser}
            onOpenChange={setShowCreateUser}
            onSuccess={() => {
              // Queries auto-invalidate via hooks
            }}
          />
        </>
      )}
    </ConsoleShell>
  );
}
