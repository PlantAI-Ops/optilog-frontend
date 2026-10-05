import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  Users,
  Factory,
  Shield,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Plus,
  BarChart2,
  Building2,
  UserPlus,
} from "lucide-react";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { SystemTenantCard, SystemTenantCardSkeleton } from "@/components/admin/SystemTenantCard";
import { SystemUserTable } from "@/components/admin/SystemUserTable";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import { EmptyState } from "@/components/admin/EmptyState";
import { UserRoleBadge } from "@/components/admin/UserRoleBadge";
import { useTenants } from "@/lib/admin-hooks";
import {
  useSystemStats,
  useSystemUsers,
  useCreateTenant,
  type UserListFilters,
} from "@/lib/admin-hooks";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import type { Role, Tenant } from "@/lib/shift-log";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/console/admin/system/")({
  head: () => ({
    meta: [
      { title: "System Admin — Overview | OptiLog" },
      { name: "description", content: "System-wide tenant and user management." },
    ],
  }),
  component: SystemAdminPage,
});

function SystemAdminPage() {
  const user = useShiftLog().user;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !hasMinRole(user.role, "system_admin")) {
      navigate({ to: "/console", replace: true });
    }
  }, [user, navigate]);

  const tenants = useTenants();
  const stats = useSystemStats();
  const createTenant = useCreateTenant();

  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "users">("overview");
  const [userPage, setUserPage] = useState(1);
  const [userFilters, setUserFilters] = useState<UserListFilters>({});
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    name: "",
    contact_email: "",
    max_users: 10,
    max_plants: 1,
  });

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = tenantForm.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      await createTenant.mutateAsync({ ...tenantForm, slug });
      setShowCreateTenant(false);
      setTenantForm({ name: "", contact_email: "", max_users: 10, max_plants: 1 });
    } catch {
      // Error handled by mutation
    }
  };

  const userParams = {
    page: userPage,
    page_size: 20,
    ...userFilters,
  };

  const users = useSystemUsers(userParams);

  if (!user || !hasMinRole(user.role, "system_admin")) {
    return null;
  }

  const loading = tenants.isLoading || stats.isLoading || users.isLoading;
  const error = tenants.error || stats.error || users.error;

  const handleTenantClick = (tenantId: string) => {
    navigate({ to: "/console/admin/system/tenant/$tenantId", params: { tenantId } });
  };

  const handleEditUser = (u: any) => {
    // Will be handled by modal
  };

  const handleDeleteUser = (u: any) => {
    // Will be handled by modal
  };

  const tenantList = tenants.data?.map((t) => ({ id: t.id, name: t.name })) || [];

  if (loading) {
    return (
      <ConsoleShell
        title="System Admin"
        subtitle="Manage all tenants and users across the platform"
      >
        <div className="space-y-6" role="status">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-4 w-24 bg-secondary/50 rounded" />
                <div className="mt-3 h-8 w-16 bg-secondary/50 rounded" />
              </div>
            ))}
          </div>
          <div className="mb-4 flex items-center justify-between">
            <div className="h-5 w-32 bg-secondary/50 rounded animate-pulse" />
          </div>
          <SystemTenantCardSkeleton count={6} />
        </div>
      </ConsoleShell>
    );
  }

  if (error) {
    return (
      <ConsoleShell
        title="System Admin"
        subtitle="Manage all tenants and users across the platform"
      >
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive"
        >
          Failed to load system data. {(tenants.error || stats.error || users.error)?.message}
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell title="System Admin" subtitle="Manage all tenants and users across the platform">
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as "overview" | "tenants" | "users")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <BarChart2 className="mr-2 h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="tenants">
            <Building2 className="mr-2 h-4 w-4" /> Tenants ({tenants.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" /> Users ({users.data?.total ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* System Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total Tenants
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {stats.data?.total_tenants ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
                  <CheckCircle className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active Tenants
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-success">
                    {stats.data?.active_tenants ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Trial Tenants
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-warning">
                    {stats.data?.trial_tenants ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total Users
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {stats.data?.total_users ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Factory className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total Plants
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {stats.data?.total_plants ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Status Breakdown */}
          {stats.data?.tenants_by_status &&
            Object.keys(stats.data.tenants_by_status as Record<string, number>).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Tenant Status Breakdown</h3>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(stats.data.tenants_by_status as Record<string, number>).map(
                    ([status, count]) => (
                      <div key={status} className="flex items-center gap-2">
                        <Badge
                          variant={
                            status === "active"
                              ? "success"
                              : status === "trial"
                                ? "warning"
                                : status === "suspended"
                                  ? "destructive"
                                  : "default"
                          }
                          className="text-xs"
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                        <span className="text-2xl font-bold tabular-nums">{count}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* User Role Breakdown */}
          {stats.data?.users_by_role &&
            Object.keys(stats.data.users_by_role as Record<string, number>).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">User Role Breakdown</h3>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(stats.data.users_by_role as Record<string, number>).map(
                    ([role, count]) => (
                      <div key={role} className="flex items-center gap-2">
                        <UserRoleBadge role={role as any} variant="compact" />
                        <span className="text-2xl font-bold tabular-nums">{count}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setShowCreateUser(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create User
              </Button>
              <Button onClick={() => setShowCreateTenant(true)}>
                <Building2 className="mr-2 h-4 w-4" /> Create Tenant
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("tenants")}>
                <Building2 className="mr-2 h-4 w-4" /> Manage Tenants
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("users")}>
                <Users className="mr-2 h-4 w-4" /> Manage Users
              </Button>
            </div>
          </div>

          {/* Recent Tenants */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Tenants</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab("tenants")}>
                View all
              </Button>
            </div>
            {tenants.data && tenants.data.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tenants.data.slice(0, 6).map((tenant) => (
                  <SystemTenantCard
                    key={tenant.id}
                    tenant={tenant}
                    onNavigate={handleTenantClick}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Building2}
                title="NO TENANTS YET"
                description="Create your first tenant to start managing users and plants"
                action={{
                  label: "Create Tenant",
                  onClick: () => setShowCreateTenant(true),
                  icon: Plus,
                }}
                variant="inline"
              />
            )}
          </div>
        </TabsContent>

        {/* TENANTS TAB */}
        <TabsContent value="tenants" className="mt-6 space-y-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">All Tenants ({tenants.data?.length ?? 0})</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateTenant(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" /> Create Tenant
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {stats.data && <span>{stats.data.total_users} total users</span>}
              </div>
            </div>
          </div>

          {tenants.data && tenants.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tenants.data.map((tenant) => (
                <SystemTenantCard key={tenant.id} tenant={tenant} onNavigate={handleTenantClick} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="NO TENANTS"
              description="Create your first tenant to start managing users and plants"
              action={{
                label: "Create Tenant",
                onClick: () => setShowCreateTenant(true),
                icon: Plus,
              }}
              variant="section"
            />
          )}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-6 space-y-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">All Users ({users.data?.total ?? 0})</h2>
            <Button onClick={() => setShowCreateUser(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create User
            </Button>
          </div>

          {users.data && (
            <SystemUserTable
              users={users.data.users ?? []}
              total={users.data.total}
              page={userPage}
              limit={users.data.limit}
              onPageChange={setUserPage}
              onFiltersChange={setUserFilters}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              tenants={tenantList}
              loading={users.isLoading}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Create User Modal */}
      <CreateUserModal
        open={showCreateUser}
        onOpenChange={setShowCreateUser}
        onSuccess={() => {
          // Queries auto-invalidate via hooks
        }}
      />

      {/* Create Tenant Modal */}
      <Dialog open={showCreateTenant} onOpenChange={setShowCreateTenant}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Name</Label>
              <Input
                id="tenant-name"
                value={tenantForm.name}
                onChange={(e) => setTenantForm((f) => ({ ...f, name: e.target.value }))}
                required
                disabled={createTenant.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-email">Contact Email</Label>
              <Input
                id="tenant-email"
                type="email"
                value={tenantForm.contact_email}
                onChange={(e) => setTenantForm((f) => ({ ...f, contact_email: e.target.value }))}
                required
                disabled={createTenant.isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-max-users">Max Users</Label>
                <Input
                  id="tenant-max-users"
                  type="number"
                  min={1}
                  value={tenantForm.max_users}
                  onChange={(e) =>
                    setTenantForm((f) => ({ ...f, max_users: Number(e.target.value) }))
                  }
                  disabled={createTenant.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-max-plants">Max Plants</Label>
                <Input
                  id="tenant-max-plants"
                  type="number"
                  min={1}
                  value={tenantForm.max_plants}
                  onChange={(e) =>
                    setTenantForm((f) => ({ ...f, max_plants: Number(e.target.value) }))
                  }
                  disabled={createTenant.isPending}
                />
              </div>
            </div>
            {createTenant.isError && (
              <p className="text-sm text-destructive" role="alert">
                {createTenant.error.message}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateTenant(false)}
                disabled={createTenant.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsoleShell>
  );
}
