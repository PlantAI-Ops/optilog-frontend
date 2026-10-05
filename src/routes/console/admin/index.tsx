import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { TenantCard } from "@/components/admin/TenantCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenants, useCreateTenant } from "@/lib/admin-hooks";
import { useShiftLog } from "@/lib/shift-log";

export const Route = createFileRoute("/console/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Tenants | OptiLog" },
      { name: "description", content: "Manage tenants and client onboarding." },
    ],
  }),
  component: AdminTenantsPage,
});

function AdminTenantsPage() {
  const user = useShiftLog().user;
  const navigate = useNavigate();
  const tenants = useTenants();
  const createTenant = useCreateTenant();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact_email: "",
    max_users: 10,
    max_plants: 1,
  });

  useEffect(() => {
    if (user && user.role !== "system_admin" && user.tenant_id) {
      navigate({
        to: "/console/admin/$tenantId",
        params: { tenantId: user.tenant_id },
        replace: true,
      });
    }
  }, [user, navigate]);

  if (!user || user.role !== "system_admin") {
    return null;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      await createTenant.mutateAsync({ ...form, slug });
      setShowCreate(false);
      setForm({ name: "", contact_email: "", max_users: 10, max_plants: 1 });
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <ConsoleShell title="Admin" subtitle="Manage tenants and client onboarding">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tenants</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> New Tenant
        </button>
      </div>

      {tenants.isLoading && (
        <div className="flex items-center justify-center py-20" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading tenants</span>
        </div>
      )}

      {tenants.error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive"
        >
          Failed to load tenants. {tenants.error.message}
        </div>
      )}

      {tenants.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.data.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
          {tenants.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tenants yet. Create one to get started.
            </p>
          )}
        </div>
      )}

      {/* Create tenant modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium" htmlFor="tenant-name">
                Name
              </label>
              <input
                id="tenant-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="tenant-email">
                Contact email
              </label>
              <input
                id="tenant-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium" htmlFor="tenant-max-users">
                  Max users
                </label>
                <input
                  id="tenant-max-users"
                  type="number"
                  min={1}
                  value={form.max_users}
                  onChange={(e) => setForm((f) => ({ ...f, max_users: Number(e.target.value) }))}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="tenant-max-plants">
                  Max plants
                </label>
                <input
                  id="tenant-max-plants"
                  type="number"
                  min={1}
                  value={form.max_plants}
                  onChange={(e) => setForm((f) => ({ ...f, max_plants: Number(e.target.value) }))}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            {createTenant.isError && (
              <p className="text-sm text-destructive" role="alert">
                {createTenant.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTenant.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createTenant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ConsoleShell>
  );
}
