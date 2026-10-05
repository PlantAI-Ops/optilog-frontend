import { useState, useEffect } from "react";
import { X, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { SystemUser, Role, Tenant, AdminPlant } from "@/lib/shift-log";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import { useUpdateSystemUser, useDeleteSystemUser, useTenants, useTenantPlants } from "@/lib/admin-hooks";

interface UserEditModalProps {
  user: SystemUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "operator", label: "Operator", description: "Floor capture only" },
  { value: "technician", label: "Technician", description: "Maintenance tasks" },
  { value: "supervisor", label: "Supervisor", description: "Shift oversight" },
  { value: "shift_manager", label: "Shift Manager", description: "Shift scheduling" },
  { value: "plant_manager", label: "Plant Manager", description: "Plant admin" },
  { value: "integration_admin", label: "Integration Admin", description: "Integrations config" },
  // system_admin excluded - cannot grant via this UI
];

export function UserEditModal({ user, open, onOpenChange, onSuccess }: UserEditModalProps) {
  const caller = useShiftLog().user;
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [tenantId, setTenantId] = useState("");
  const [plantIds, setPlantIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSystemAdmin = caller?.role === "system_admin";
  // Callers may only grant roles at or below their own rank.
  const roleOptions = ROLE_OPTIONS.filter((r) => caller && hasMinRole(caller.role, r.value));

  const updateUser = useUpdateSystemUser(user?.id || "");
  const deleteUser = useDeleteSystemUser();
  const tenants = useTenants(isSystemAdmin);
  const plantsQuery = useTenantPlants(tenantId || undefined);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setTenantId(user.tenant_id ?? "");
      setPlantIds(user.plant_ids || []);
      setActive(user.active);
      setError("");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      await updateUser.mutateAsync({
        name: name.trim(),
        // Only send the role when it actually changed, so callers never have to
        // re-grant a role they cannot grant.
        ...(role !== user.role ? { role } : {}),
        // Tenant moves are system_admin-only; send the field only when it
        // actually changed. The backend clears plant_ids whenever tenant_id
        // is present, so re-sending an unchanged tenant would silently wipe
        // the plant assignments made in this same payload.
        ...(isSystemAdmin && tenantId !== (user.tenant_id ?? "") ? { tenant_id: tenantId } : {}),
        plant_ids: plantIds,
        active,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    try {
      await deleteUser.mutateAsync(user.id);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  // A user whose role sits above the caller's rank is read-only for the role field.
  const canGrantCurrentRole = !caller || !user || hasMinRole(caller.role, user.role);

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={user.email} disabled />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here — contact a system administrator.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value: string) => setRole(value as Role)} disabled={loading || !canGrantCurrentRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canGrantCurrentRole && (
                <p className="text-xs text-muted-foreground">
                  This role is managed by a higher-level administrator.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              <p className="text-sm">{user.team_name ?? "Not assigned"}</p>
              <p className="text-xs text-muted-foreground">
                Team membership is managed from the Teams page (supervisor+).
              </p>
            </div>

            {isSystemAdmin && (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select
                  value={tenantId}
                  onValueChange={(value: string) => {
                    setTenantId(value);
                    // Plant assignments are tenant-scoped — clear them on a move.
                    setPlantIds([]);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.data?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Plant Access</Label>
              <p className="text-xs text-muted-foreground">Select plants this user can access</p>
              {plantsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading plants...</p>
              ) : (plantsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">No plants in this tenant yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(plantsQuery.data ?? []).map((p) => {
                    const selected = plantIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          setPlantIds(
                            selected
                              ? plantIds.filter((id) => id !== p.id)
                              : [...plantIds, p.id],
                          )
                        }
                        className={
                          selected
                            ? "inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                            : "inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                        }
                      >
                        {selected && <Check className="size-3" />}
                        {p.name}
                      </button>
                    );
                  })}
                  {/* Selected ids whose plant no longer exists — keep them visible so they can be removed. */}
                  {plantIds
                    .filter((pid) => !(plantsQuery.data ?? []).some((p) => p.id === pid))
                    .map((pid) => (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs"
                      >
                        {pid.slice(0, 8) + "..."}
                        <button
                          type="button"
                          onClick={() => setPlantIds(plantIds.filter((id) => id !== pid))}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={active}
                onCheckedChange={(checked: boolean) => setActive(checked)}
                disabled={loading}
              />
              <Label htmlFor="edit-active" className="text-sm font-medium cursor-pointer">
                Active
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="ml-2">
            <AlertCircle className="mr-1.5 size-3.5" /> Deactivate
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{user.name}</strong>? This will revoke their access but preserve their data. This action can be undone by editing the user and setting Active to true.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}